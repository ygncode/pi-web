package server

// Multi-user hub support: every session has an owner (a tailnet login). The
// left sidebar shows only the caller's own sessions by default; a people
// switcher (cookie pi_view_owner) lets a person browse and open colleagues'
// sessions to work on them together. Disabled unless Deps.MultiUser is set, so
// single-user installs behave exactly as before.

import (
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"pi-web/internal/identity"
	"pi-web/internal/sessions"
)

const sessionOwnersSchema = `CREATE TABLE IF NOT EXISTS session_owners (
	session_id TEXT PRIMARY KEY,
	owner      TEXT NOT NULL,
	source     TEXT NOT NULL DEFAULT '',
	created_at DATETIME
)`

const (
	viewOwnerCookie = "pi_view_owner"
	viewMine        = "me"
	viewAll         = "all"
	viewUnassigned  = "_unassigned"
	// archivedPrefix marks owners of people who left (e.g. "ex-daniel"). Their
	// sessions stay stored (LoRA corpus) but are hidden from every default and
	// "all" view; they are only listed under Pessoas → Arquivados.
	archivedPrefix = "ex-"
)

func isArchivedOwner(owner string) bool { return strings.HasPrefix(owner, archivedPrefix) }

// currentUser resolves the caller. With multi-user disabled it is anonymous.
func (s *Server) currentUser(r *http.Request) identity.User {
	if !s.multiUser || s.identity == nil {
		return identity.User{Via: "anonymous"}
	}
	return s.identity.Identify(r)
}

// setSessionOwner records owner for a session id (filename). Existing rows are
// kept: the first person to create a session owns it.
func (s *Server) setSessionOwner(sessionID, owner, source string) {
	if s.db == nil || sessionID == "" || owner == "" {
		return
	}
	_, _ = s.db.Exec(`INSERT OR IGNORE INTO session_owners (session_id, owner, source, created_at) VALUES (?, ?, ?, ?)`,
		sessionID, strings.ToLower(owner), source, s.now().UTC().Format(time.RFC3339))
}

// claimForCaller records the caller as owner of a newly created session.
func (s *Server) claimForCaller(r *http.Request, sessionID, source string) {
	if !s.multiUser {
		return
	}
	if u := s.currentUser(r); u.Known() {
		s.setSessionOwner(sessionID, u.Login, source)
	}
}

func (s *Server) ownerRegistry() map[string]string {
	out := map[string]string{}
	if s.db == nil {
		return out
	}
	rows, err := s.db.Query(`SELECT session_id, owner FROM session_owners`)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var id, owner string
		if rows.Scan(&id, &owner) == nil {
			out[id] = owner
		}
	}
	return out
}

// annotateOwners fills Owner from the registry (which wins over the header).
func (s *Server) annotateOwners(summaries []sessions.SessionSummary) {
	reg := s.ownerRegistry()
	for i := range summaries {
		if o, ok := reg[summaries[i].ID]; ok {
			summaries[i].Owner = o
		}
		summaries[i].Owner = strings.ToLower(summaries[i].Owner)
	}
}

// ownerMatches reports whether a session owned by owner belongs to login.
// Owners recorded as a bare short name ("vinicius") match the full login.
func ownerMatches(owner, login string) bool {
	if owner == "" || login == "" {
		return false
	}
	return owner == login || owner == identity.ShortName(login) || identity.ShortName(owner) == identity.ShortName(login) && !strings.Contains(owner, "@")
}

// viewOwner returns the requested sidebar scope: query ?owner= wins, then the
// pi_view_owner cookie, then "me".
func viewOwner(r *http.Request) string {
	if v := strings.TrimSpace(r.URL.Query().Get("owner")); v != "" {
		return strings.ToLower(v)
	}
	if c, err := r.Cookie(viewOwnerCookie); err == nil {
		if v, err := url.QueryUnescape(c.Value); err == nil && strings.TrimSpace(v) != "" {
			return strings.ToLower(strings.TrimSpace(v))
		}
	}
	return viewMine
}

// filterByOwner keeps the sessions visible in the given scope.
// Unknown callers (anonymous, tagged devices, failed whois) see nothing.
func filterByOwner(summaries []sessions.SessionSummary, scope string, me identity.User) []sessions.SessionSummary {
	if !me.Known() {
		return []sessions.SessionSummary{}
	}
	if scope == viewAll {
		out := make([]sessions.SessionSummary, 0, len(summaries))
		for _, sum := range summaries {
			if !isArchivedOwner(sum.Owner) {
				out = append(out, sum)
			}
		}
		return out
	}
	if scope == viewMine {
		scope = me.Login
	}
	out := make([]sessions.SessionSummary, 0, len(summaries))
	for _, sum := range summaries {
		switch {
		case scope == viewUnassigned:
			if sum.Owner == "" {
				out = append(out, sum)
			}
		case ownerMatches(sum.Owner, scope):
			out = append(out, sum)
		}
	}
	return out
}

// scopedSummaries loads summaries with owners annotated and, in multi-user
// mode, filtered to the caller's current view.
func (s *Server) scopedSummaries(r *http.Request) ([]sessions.SessionSummary, error) {
	summaries, err := s.loadSummaries()
	if err != nil || !s.multiUser {
		return summaries, err
	}
	cp := make([]sessions.SessionSummary, len(summaries))
	copy(cp, summaries)
	s.annotateOwners(cp)
	return filterByOwner(cp, viewOwner(r), s.currentUser(r)), nil
}

type personInfo struct {
	Login    string `json:"login"`
	Short    string `json:"short"`
	Name     string `json:"name,omitempty"`
	Sessions int    `json:"sessions"`
	Me       bool   `json:"me"`
	Archived bool   `json:"archived,omitempty"`
}

// handleApiPeople returns the caller, the current view and everyone who owns
// sessions on this hub.
func (s *Server) handleApiPeople(w http.ResponseWriter, r *http.Request) {
	me := s.currentUser(r)
	if !s.multiUser {
		writeJSON(w, 0, map[string]any{"multiUser": false, "me": me, "view": viewAll, "people": []personInfo{}})
		return
	}
	if !me.Known() {
		writeJSON(w, 0, map[string]any{"multiUser": true, "me": me, "view": viewMine, "people": []personInfo{}, "unassigned": 0, "total": 0})
		return
	}
	summaries, err := s.loadSummaries()
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	cp := make([]sessions.SessionSummary, len(summaries))
	copy(cp, summaries)
	s.annotateOwners(cp)
	counts := map[string]int{}
	unassigned, visibleTotal := 0, 0
	for _, sum := range s.filterBtwSummaries(cp) {
		if !isArchivedOwner(sum.Owner) {
			visibleTotal++
		}
		if sum.Owner == "" {
			unassigned++
			continue
		}
		key := sum.Owner
		if me.Known() && ownerMatches(sum.Owner, me.Login) {
			key = me.Login
		}
		counts[key]++
	}
	if me.Known() {
		if _, ok := counts[me.Login]; !ok {
			counts[me.Login] = 0
		}
	}
	people := make([]personInfo, 0, len(counts))
	for login, n := range counts {
		p := personInfo{Login: login, Short: identity.ShortName(login), Sessions: n, Archived: isArchivedOwner(login)}
		if p.Archived {
			p.Name = strings.TrimPrefix(p.Short, archivedPrefix) + " (arquivado)"
		}
		if me.Known() && login == me.Login {
			p.Me = true
			p.Name = me.Name
		}
		people = append(people, p)
	}
	sort.Slice(people, func(i, j int) bool {
		if people[i].Me != people[j].Me {
			return people[i].Me
		}
		return people[i].Short < people[j].Short
	})
	writeJSON(w, 0, map[string]any{
		"multiUser":  true,
		"me":         me,
		"view":       viewOwner(r),
		"people":     people,
		"unassigned": unassigned,
		"total":      visibleTotal,
	})
}

// handleApiSessionOwner returns (GET) or reassigns (POST) a session's owner.
func (s *Server) handleApiSessionOwner(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if r.Method == http.MethodPost {
		var body struct {
			ID    string `json:"id"`
			Owner string `json:"owner"`
		}
		if !decodeJSONBody(w, r, &body) {
			return
		}
		if body.ID == "" || body.Owner == "" {
			writeJSONError(w, http.StatusBadRequest, "id and owner are required")
			return
		}
		if s.db != nil {
			_, _ = s.db.Exec(`INSERT INTO session_owners (session_id, owner, source, created_at) VALUES (?, ?, '', ?)
				ON CONFLICT(session_id) DO UPDATE SET owner = excluded.owner`,
				body.ID, strings.ToLower(strings.TrimSpace(body.Owner)), s.now().UTC().Format(time.RFC3339))
		}
		writeJSON(w, 0, map[string]any{"ok": true})
		return
	}
	if id == "" {
		writeJSONError(w, http.StatusBadRequest, "id is required")
		return
	}
	owner, source := "", ""
	if resolved, err := s.cache.Resolve(s.sessionsDir, id); err == nil {
		owner, source = resolved.Session.Owner, resolved.Session.Source
	}
	if o, ok := s.ownerRegistry()[id]; ok {
		owner = o
	}
	me := s.currentUser(r)
	writeJSON(w, 0, map[string]any{
		"multiUser": s.multiUser,
		"owner":     strings.ToLower(owner),
		"short":     identity.ShortName(owner),
		"source":    source,
		"mine":      me.Known() && ownerMatches(strings.ToLower(owner), me.Login),
	})
}
