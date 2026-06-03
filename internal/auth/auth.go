package auth

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"pi-web/internal/ui"
)

const TokenCookieName = "pi_token"

type Middleware struct {
	token string
}

func New(token string) *Middleware {
	return &Middleware{token: strings.TrimSpace(token)}
}

func (a *Middleware) Enabled() bool {
	return a.token != ""
}

// Wrap returns a handler that enforces the token check when auth is enabled.
//
// Token sources (checked in order): for browser POSTs, form body first;
// otherwise query parameter, Authorization header, X-Pi-Token header, and
// cookie. When the token arrives via query or POST, a cookie is set and the
// browser is redirected to the same URL without the token, so the secret never
// appears in the address bar or browser history.
//
// When auth fails and the request appears to come from a browser (Accept
// header includes text/html), the middleware serves an HTML token prompt
// instead of a bare 401. API clients (no text/html in Accept) still receive
// a plain 401.
func (a *Middleware) Wrap(h http.HandlerFunc) http.HandlerFunc {
	if !a.Enabled() {
		return h
	}
	return func(w http.ResponseWriter, r *http.Request) {
		got := ""
		fromQuery := false
		fromPost := false

		// Browser login form submissions should prefer the submitted token over
		// any stale token that may still be present in the URL query string.
		if r.Method == http.MethodPost && strings.Contains(r.Header.Get("Accept"), "text/html") {
			// ParseForm is idempotent; safe to call even if already parsed.
			r.ParseForm()
			if t := r.PostFormValue("token"); t != "" {
				got = t
				fromPost = true
			}
		}

		if got == "" {
			got, fromQuery = ExtractToken(r)
		}

		if subtle.ConstantTimeCompare([]byte(got), []byte(a.token)) != 1 {
			if strings.Contains(r.Header.Get("Accept"), "text/html") {
				// Invalid login attempt — redirect with error flag so
				// the prompt shows "Invalid token".
				if fromPost {
					target := cleanURL(r)
					if strings.Contains(target, "?") {
						target += "&error=1"
					} else {
						target += "?error=1"
					}
					http.Redirect(w, r, target, http.StatusFound)
					return
				}
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(ui.AuthPromptHTML))
				return
			}
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Token is valid. Set a cookie if it came from query or POST so
		// subsequent requests authenticate automatically.
		shouldSetCookie := fromQuery || fromPost
		if shouldSetCookie {
			http.SetCookie(w, &http.Cookie{
				Name:     TokenCookieName,
				Value:    got,
				Path:     "/",
				HttpOnly: true,
				SameSite: http.SameSiteLaxMode,
				MaxAge:   30 * 24 * 60 * 60,
			})
		}

		// Redirect to a clean URL (no token in query or error flag) when
		// the token arrived via query or POST. This keeps the secret out
		// of the address bar and browser history.
		if fromQuery || fromPost {
			http.Redirect(w, r, cleanURL(r), http.StatusFound)
			return
		}

		h(w, r)
	}
}

// cleanURL returns r.URL.Path with query string intact except for "token" and
// "error" parameters, which are stripped.
func cleanURL(r *http.Request) string {
	q := r.URL.Query()
	q.Del("token")
	q.Del("error")
	if len(q) == 0 {
		return r.URL.Path
	}
	return r.URL.Path + "?" + q.Encode()
}

// ExtractToken returns the candidate token and whether it came from the query
// string (in which case a cookie should be set).
func ExtractToken(r *http.Request) (string, bool) {
	if t := r.URL.Query().Get("token"); t != "" {
		return t, true
	}
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer "), false
	}
	if h := r.Header.Get("X-Pi-Token"); h != "" {
		return h, false
	}
	if c, err := r.Cookie(TokenCookieName); err == nil {
		return c.Value, false
	}
	return "", false
}
