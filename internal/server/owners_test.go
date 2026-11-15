package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"pi-web/internal/identity"
)

func newMultiUserServer(t *testing.T) *Server {
	t.Helper()
	s := newTestServer(t)
	s.multiUser = true
	s.identity = &identity.Resolver{Whois: func(_ context.Context, ip string) (string, string, error) {
		switch ip {
		case "100.64.0.1":
			return "ana@symetrix.com", "Ana", nil
		case "100.64.0.2":
			return "bruno@symetrix.com", "Bruno", nil
		}
		return "", "", nil
	}}
	return s
}

func writeOwnedSession(t *testing.T, root, project, name, owner string) {
	t.Helper()
	dir := filepath.Join(root, project)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	ownerField := ""
	if owner != "" {
		ownerField = `,"owner":` + jsonString(owner) + `,"source":"claude-code"`
	}
	content := `{"type":"session","version":3,"id":"` + name + `","timestamp":"2026-05-06T00:00:00.000Z","cwd":"/tmp"` + ownerField + `}` + "\n" +
		`{"type":"message","id":"aaaaaaaa","parentId":null,"timestamp":"2026-05-06T00:00:01.000Z","message":{"role":"user","content":"hello","timestamp":1778025601000}}` + "\n"
	if err := os.WriteFile(filepath.Join(dir, name+".jsonl"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func sessionsAs(t *testing.T, s *Server, ip, query string, cookie string) []string {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/sessions"+query, nil)
	req.RemoteAddr = ip + ":4000"
	if cookie != "" {
		req.AddCookie(&http.Cookie{Name: viewOwnerCookie, Value: cookie})
	}
	w := httptest.NewRecorder()
	s.handleApiSessions(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var body struct {
		Sessions []struct{ ID, Owner string } `json:"sessions"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, x := range body.Sessions {
		ids = append(ids, x.ID)
	}
	return ids
}

func TestMultiUserSidebarShowsOnlyOwnSessionsByDefault(t *testing.T) {
	s := newMultiUserServer(t)
	writeOwnedSession(t, s.sessionsDir, "--p--", "a1", "ana@symetrix.com")
	writeOwnedSession(t, s.sessionsDir, "--p--", "a2", "ana") // short-name owner from an import
	writeOwnedSession(t, s.sessionsDir, "--p--", "b1", "bruno@symetrix.com")
	writeOwnedSession(t, s.sessionsDir, "--p--", "u1", "")

	got := strings.Join(sessionsAs(t, s, "100.64.0.1", "", ""), ",")
	if !strings.Contains(got, "a1") || !strings.Contains(got, "a2") || strings.Contains(got, "b1") || strings.Contains(got, "u1") {
		t.Fatalf("ana default view = %s", got)
	}
	// Browse a colleague via the switcher cookie and via ?owner=.
	if got := strings.Join(sessionsAs(t, s, "100.64.0.1", "", "bruno@symetrix.com"), ","); got != "b1.jsonl" {
		t.Fatalf("cookie view of bruno = %s", got)
	}
	if got := sessionsAs(t, s, "100.64.0.1", "?owner=all", ""); len(got) != 4 {
		t.Fatalf("all view = %v", got)
	}
	if got := strings.Join(sessionsAs(t, s, "100.64.0.2", "?owner=_unassigned", ""), ","); got != "u1.jsonl" {
		t.Fatalf("unassigned view = %s", got)
	}
}

func TestMultiUserNewSessionIsClaimedAndRegistryWins(t *testing.T) {
	s := newMultiUserServer(t)
	writeOwnedSession(t, s.sessionsDir, "--p--", "x1", "ana@symetrix.com")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "100.64.0.2:1"
	s.claimForCaller(req, "x1.jsonl", "")
	if got := strings.Join(sessionsAs(t, s, "100.64.0.2", "", ""), ","); got != "x1.jsonl" {
		t.Fatalf("registry owner should win over header, bruno sees %q", got)
	}
	// INSERT OR IGNORE: a second claim does not steal ownership.
	req.RemoteAddr = "100.64.0.1:1"
	s.claimForCaller(req, "x1.jsonl", "")
	if got := sessionsAs(t, s, "100.64.0.1", "", ""); len(got) != 0 {
		t.Fatalf("ana should not own x1 anymore, got %v", got)
	}
}

func TestPeopleAndSessionOwnerEndpoints(t *testing.T) {
	s := newMultiUserServer(t)
	writeOwnedSession(t, s.sessionsDir, "--p--", "a1", "ana@symetrix.com")
	writeOwnedSession(t, s.sessionsDir, "--p--", "b1", "bruno@symetrix.com")
	writeOwnedSession(t, s.sessionsDir, "--p--", "u1", "")
	req := httptest.NewRequest(http.MethodGet, "/api/people", nil)
	req.RemoteAddr = "100.64.0.1:1"
	w := httptest.NewRecorder()
	s.handleApiPeople(w, req)
	var body struct {
		Me         identity.User `json:"me"`
		People     []personInfo  `json:"people"`
		Unassigned int           `json:"unassigned"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Me.Short != "ana" || len(body.People) != 2 || !body.People[0].Me || body.People[1].Short != "bruno" || body.Unassigned != 1 {
		t.Fatalf("people = %+v", body)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/session-owner?id=b1.jsonl", nil)
	req.RemoteAddr = "100.64.0.1:1"
	w = httptest.NewRecorder()
	s.handleApiSessionOwner(w, req)
	if !strings.Contains(w.Body.String(), `"short":"bruno"`) || !strings.Contains(w.Body.String(), `"mine":false`) || !strings.Contains(w.Body.String(), `"source":"claude-code"`) {
		t.Fatalf("session-owner = %s", w.Body.String())
	}
}

func TestSingleUserModeUnchanged(t *testing.T) {
	s := newTestServer(t)
	writeOwnedSession(t, s.sessionsDir, "--p--", "a1", "ana@symetrix.com")
	writeOwnedSession(t, s.sessionsDir, "--p--", "b1", "bruno@symetrix.com")
	if got := sessionsAs(t, s, "100.64.0.1", "", ""); len(got) != 2 {
		t.Fatalf("single-user should list everything, got %v", got)
	}
}

func TestMultiUserUnknownCallerSeesNothing(t *testing.T) {
	s := newMultiUserServer(t)
	writeOwnedSession(t, s.sessionsDir, "--p--", "a1", "ana@symetrix.com")
	writeOwnedSession(t, s.sessionsDir, "--p--", "u1", "")
	// 100.64.0.9 resolves to no login (e.g. a tagged device); 10.0.0.5 is off-tailnet.
	for _, ip := range []string{"100.64.0.9", "10.0.0.5", "127.0.0.1"} {
		for _, q := range []string{"", "?owner=all", "?owner=_unassigned", "?owner=ana@symetrix.com"} {
			if got := sessionsAs(t, s, ip, q, ""); len(got) != 0 {
				t.Fatalf("unknown caller %s%s saw %v", ip, q, got)
			}
		}
	}
	// A spoofed identity header from a tailnet peer is ignored (whois wins).
	req := httptest.NewRequest(http.MethodGet, "/api/sessions", nil)
	req.RemoteAddr = "100.64.0.9:1"
	req.Header.Set("Tailscale-User-Login", "ana@symetrix.com")
	w := httptest.NewRecorder()
	s.handleApiSessions(w, req)
	if strings.Contains(w.Body.String(), "a1") {
		t.Fatalf("spoofed header leaked sessions: %s", w.Body.String())
	}
}

func TestArchivedOwnerHiddenExceptExplicitView(t *testing.T) {
	s := newMultiUserServer(t)
	writeOwnedSession(t, s.sessionsDir, "--p--", "a1", "ana@symetrix.com")
	writeOwnedSession(t, s.sessionsDir, "--p--", "d1", "")
	s.setSessionOwner("d1.jsonl", "ex-daniel", "claude-code")
	if got := strings.Join(sessionsAs(t, s, "100.64.0.1", "?owner=all", ""), ","); got != "a1.jsonl" {
		t.Fatalf("all view should hide archived, got %s", got)
	}
	if got := strings.Join(sessionsAs(t, s, "100.64.0.1", "?owner=ex-daniel", ""), ","); got != "d1.jsonl" {
		t.Fatalf("explicit archived view = %s", got)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/people", nil)
	req.RemoteAddr = "100.64.0.1:1"
	w := httptest.NewRecorder()
	s.handleApiPeople(w, req)
	if !strings.Contains(w.Body.String(), `"archived":true`) || !strings.Contains(w.Body.String(), "daniel (arquivado)") {
		t.Fatalf("people = %s", w.Body.String())
	}
}
