package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func okHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}

func TestAuthDisabledPassesThrough(t *testing.T) {
	a := New("")
	if a.Enabled() {
		t.Fatal("expected Enabled()=false when token empty")
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:31415/", nil)
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestAuthRejectsMissingToken(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	a.Wrap(okHandler)(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestAuthRejectsWrongToken(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/?token=nope", nil)
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

// Query-based token now redirects to a clean URL after setting the cookie.
func TestAuthAcceptsQueryAndRedirects(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/?token=secret", nil)
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302 redirect", rec.Code)
	}
	loc := rec.Header().Get("Location")
	if loc != "/" {
		t.Fatalf("redirect Location = %q, want /", loc)
	}
	cookies := rec.Result().Cookies()
	var found *http.Cookie
	for _, c := range cookies {
		if c.Name == TokenCookieName {
			found = c
			break
		}
	}
	if found == nil {
		t.Fatalf("expected %s cookie to be set", TokenCookieName)
	}
	if found.Value != "secret" {
		t.Fatalf("cookie value = %q", found.Value)
	}
	if !found.HttpOnly {
		t.Fatal("expected HttpOnly cookie")
	}
	if found.Secure {
		t.Fatal("expected cookie to not be Secure over plain HTTP")
	}
}

// Behind Tailscale Serve (X-Forwarded-Proto: https) the cookie must be Secure.
func TestAuthSetsSecureCookieForForwardedHTTPS(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/?token=secret", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	a.Wrap(okHandler)(rec, req)
	var found *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == TokenCookieName {
			found = c
			break
		}
	}
	if found == nil {
		t.Fatalf("expected %s cookie to be set", TokenCookieName)
	}
	if !found.Secure {
		t.Fatal("expected Secure cookie when forwarded proto is https")
	}
}

// Query-based token with other params preserves them in redirect.
func TestAuthAcceptsQueryPreservesOtherParams(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/session?id=abc123&token=secret", nil)
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302 redirect", rec.Code)
	}
	loc := rec.Header().Get("Location")
	if !strings.HasPrefix(loc, "/session?id=abc123") {
		t.Fatalf("redirect Location = %q, want /session?id=abc123", loc)
	}
	if strings.Contains(loc, "token=") {
		t.Fatal("redirect URL must not contain token parameter")
	}
}

func TestAuthAcceptsCookie(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: TokenCookieName, Value: "secret"})
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	// Cookie was already present; we should not re-set it.
	for _, c := range rec.Result().Cookies() {
		if c.Name == TokenCookieName {
			t.Fatal("did not expect cookie to be re-set when request already had it")
		}
	}
}

func TestAuthAcceptsBearerHeader(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer secret")
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestAuthAcceptsXPiTokenHeader(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Pi-Token", "secret")
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestAuthEmptyTokenSubmittedWhenAuthEnabled(t *testing.T) {
	// Empty submitted value must not match an empty stored value
	// (which can't happen since Enabled() requires non-empty, but check
	// constant-time compare doesn't accept "").
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/?token=", nil)
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

// ── Browser prompts (Accept: text/html) ───────────────────────────────────

func TestAuthRejectsBrowserWithHTMLPrompt(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	ct := rec.Header().Get("Content-Type")
	if !strings.Contains(ct, "text/html") {
		t.Fatalf("Content-Type = %q, want text/html", ct)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "pi-web") {
		t.Fatal("expected HTML token prompt in response body")
	}
	if !strings.HasPrefix(strings.ToLower(body), "<!doctype html>") {
		t.Fatal("expected HTML response")
	}
}

func TestAuthRedirectsBrowserWithWrongQueryToken(t *testing.T) {
	// When a token is in the query and it's wrong, the browser prompt is
	// served. The "Invalid token" text is in the HTML (hidden until JS
	// detects ?error=1).
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/?token=nope", nil)
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "Invalid access token") {
		t.Fatal("expected error message text in HTML prompt")
	}
}

// ── POST login (the token prompt form) ────────────────────────────────────

func TestAuthAcceptsPostLoginAndRedirects(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	body := strings.NewReader("token=secret")
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302 redirect", rec.Code)
	}
	loc := rec.Header().Get("Location")
	if loc != "/" {
		t.Fatalf("redirect Location = %q, want /", loc)
	}
	cookies := rec.Result().Cookies()
	var found *http.Cookie
	for _, c := range cookies {
		if c.Name == TokenCookieName {
			found = c
			break
		}
	}
	if found == nil {
		t.Fatalf("expected %s cookie to be set after POST login", TokenCookieName)
	}
	if found.Value != "secret" {
		t.Fatalf("cookie value = %q", found.Value)
	}
}

func TestAuthRejectsPostLoginWithErrorRedirect(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	body := strings.NewReader("token=wrong")
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302 redirect", rec.Code)
	}
	loc := rec.Header().Get("Location")
	if !strings.Contains(loc, "error=1") {
		t.Fatalf("redirect Location = %q, want to contain error=1", loc)
	}
	if strings.Contains(loc, "token=") {
		t.Fatal("redirect URL must not contain token parameter")
	}
}

func TestAuthPostLoginPrefersFormTokenOverStaleQuery(t *testing.T) {
	a := New("secret")
	rec := httptest.NewRecorder()
	body := strings.NewReader("token=secret")
	req := httptest.NewRequest(http.MethodPost, "/session?id=abc&token=old", body)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302 redirect", rec.Code)
	}
	loc := rec.Header().Get("Location")
	if loc != "/session?id=abc" {
		t.Fatalf("redirect Location = %q, want /session?id=abc", loc)
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == TokenCookieName && c.Value == "secret" {
			return
		}
	}
	t.Fatalf("expected %s cookie to be set from form token", TokenCookieName)
}

func TestAuthAllowsBrowserWithCorrectTokenViaCookie(t *testing.T) {
	// After login, browsers use the cookie — handler proceeds normally.
	a := New("secret")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	req.AddCookie(&http.Cookie{Name: TokenCookieName, Value: "secret"})
	a.Wrap(okHandler)(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Body.String() != "ok" {
		t.Fatal("handler should have been invoked")
	}
}

func TestAuthRejectsCrossOriginMutationWhenTokenDisabled(t *testing.T) {
	a := New("")
	called := false
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:31415/api/update", nil)
	req.Header.Set("Origin", "https://evil.example")
	a.Wrap(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
	if called {
		t.Fatal("handler must not run for a cross-origin mutation")
	}
}

func TestAuthRejectsSameHostMutationFromDifferentPort(t *testing.T) {
	a := New("")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:31415/api/update", nil)
	req.Header.Set("Origin", "http://127.0.0.1:8080")
	a.Wrap(okHandler)(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestAuthAllowsSameOriginMutationWhenTokenDisabled(t *testing.T) {
	a := New("")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:31415/api/update", nil)
	req.Header.Set("Origin", "http://127.0.0.1:31415")
	a.Wrap(okHandler)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestAuthAllowsMutationWithoutBrowserOrigin(t *testing.T) {
	a := New("")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:31415/api/update", nil)
	a.Wrap(okHandler)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestAuthRejectsCrossSiteFetchWithoutOrigin(t *testing.T) {
	a := New("")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:31415/api/update", nil)
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	a.Wrap(okHandler)(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestAuthDoesNotApplyOriginCheckToSafeMethods(t *testing.T) {
	a := New("")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:31415/api/version", nil)
	req.Header.Set("Origin", "https://evil.example")
	a.Wrap(okHandler)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestAuthRejectsUnknownHostWhenTokenDisabled(t *testing.T) {
	a := New("")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://attacker.example/api/sessions", nil)
	a.Wrap(okHandler)(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestAuthAllowsConfiguredHostWhenTokenDisabled(t *testing.T) {
	a := New("")
	a.AllowHost("https://pi-host.tailnet.example")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "https://pi-host.tailnet.example/api/sessions", nil)
	a.Wrap(okHandler)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestAuthAllowsUnknownHostWhenExplicitlyConfigured(t *testing.T) {
	a := New("")
	a.AllowAnyHost()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://lan-host.example/api/sessions", nil)
	a.Wrap(okHandler)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}
