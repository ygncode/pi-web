// Package identity resolves which person is making a request to a multi-user
// pi-web hub. Identity comes from the tailnet itself, never from a value the
// browser can choose:
//
//  1. Requests proxied by `tailscale serve` arrive from loopback and carry the
//     Tailscale-User-Login / Tailscale-User-Name headers, which tailscaled sets
//     (and strips from client requests). They are only trusted from loopback.
//  2. Requests that reach pi-web directly on its tailnet IP come from a
//     100.64.0.0/10 (or fd7a:115c:a1e0::/48) peer address; the login is looked
//     up with `tailscale whois --json <ip>` and cached.
//  3. Anything else (plain loopback, LAN) maps to the configured fallback
//     owner, or to an anonymous identity.
package identity

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/netip"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// User is a resolved person.
type User struct {
	Login string `json:"login"` // e.g. vinicius@symetrixtrading.com
	Name  string `json:"name"`  // display name, e.g. "Vinicius"
	Short string `json:"short"` // e.g. "vinicius" (login local part)
	Via   string `json:"via"`   // "serve-header" | "whois" | "fallback" | "anonymous"
}

// Known reports whether the user has a real login.
func (u User) Known() bool { return u.Login != "" }

// WhoisFunc looks up a tailnet peer IP. It returns login and display name.
type WhoisFunc func(ctx context.Context, ip string) (login, name string, err error)

// Resolver maps HTTP requests to users.
type Resolver struct {
	Whois    WhoisFunc
	Fallback string // login used for non-tailnet, header-less requests
	// TrustServeHeaders accepts Tailscale-User-Login from loopback peers. Only
	// enable it when pi-web binds 127.0.0.1 behind `tailscale serve` (HTTP
	// proxy mode); otherwise identity headers are always ignored.
	TrustServeHeaders bool
	TTL               time.Duration
	now               func() time.Time

	mu    sync.Mutex
	cache map[string]cachedUser
}

type cachedUser struct {
	user    User
	expires time.Time
}

// NewResolver returns a resolver that shells out to the tailscale CLI.
func NewResolver(fallback string) *Resolver {
	return &Resolver{Whois: TailscaleWhois, Fallback: fallback, TTL: 10 * time.Minute}
}

var (
	cgnat = netip.MustParsePrefix("100.64.0.0/10")
	tsULA = netip.MustParsePrefix("fd7a:115c:a1e0::/48")
)

// ShortName returns the local part of a login (before '@'), lowercased.
func ShortName(login string) string {
	l := strings.ToLower(strings.TrimSpace(login))
	if i := strings.IndexByte(l, '@'); i > 0 {
		return l[:i]
	}
	return l
}

func makeUser(login, name, via string) User {
	login = strings.ToLower(strings.TrimSpace(login))
	if name == "" {
		name = ShortName(login)
	}
	return User{Login: login, Name: name, Short: ShortName(login), Via: via}
}

func remoteAddr(r *http.Request) (netip.Addr, bool) {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	a, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}, false
	}
	return a.Unmap(), true
}

// IsTailnetAddr reports whether a is a Tailscale peer address.
func IsTailnetAddr(a netip.Addr) bool { return cgnat.Contains(a) || tsULA.Contains(a) }

// Identify resolves the user behind r.
func (res *Resolver) Identify(r *http.Request) User {
	if res == nil {
		return User{Via: "anonymous"}
	}
	addr, ok := remoteAddr(r)
	if ok && addr.IsLoopback() && res.TrustServeHeaders {
		if login := r.Header.Get("Tailscale-User-Login"); login != "" {
			return makeUser(login, r.Header.Get("Tailscale-User-Name"), "serve-header")
		}
	}
	if ok && IsTailnetAddr(addr) && res.Whois != nil {
		if u, ok := res.lookup(r.Context(), addr.String()); ok {
			return u
		}
	}
	if res.Fallback != "" {
		return makeUser(res.Fallback, "", "fallback")
	}
	return User{Via: "anonymous"}
}

func (res *Resolver) clock() time.Time {
	if res.now != nil {
		return res.now()
	}
	return time.Now()
}

func (res *Resolver) lookup(ctx context.Context, ip string) (User, bool) {
	res.mu.Lock()
	if c, ok := res.cache[ip]; ok && res.clock().Before(c.expires) {
		res.mu.Unlock()
		return c.user, true
	}
	res.mu.Unlock()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	login, name, err := res.Whois(ctx, ip)
	if err != nil || login == "" || strings.HasPrefix(login, "tagged-devices") {
		return User{}, false
	}
	u := makeUser(login, name, "whois")
	ttl := res.TTL
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	res.mu.Lock()
	if res.cache == nil {
		res.cache = map[string]cachedUser{}
	}
	res.cache[ip] = cachedUser{user: u, expires: res.clock().Add(ttl)}
	res.mu.Unlock()
	return u, true
}

// TailscaleWhois runs `tailscale whois --json <ip>`.
func TailscaleWhois(ctx context.Context, ip string) (string, string, error) {
	out, err := exec.CommandContext(ctx, "tailscale", "whois", "--json", ip).Output()
	if err != nil {
		return "", "", err
	}
	return ParseWhoisJSON(out)
}

// ParseWhoisJSON extracts login and display name from `tailscale whois --json`.
func ParseWhoisJSON(b []byte) (string, string, error) {
	var w struct {
		UserProfile struct {
			LoginName   string `json:"LoginName"`
			DisplayName string `json:"DisplayName"`
		} `json:"UserProfile"`
	}
	if err := json.Unmarshal(b, &w); err != nil {
		return "", "", err
	}
	return w.UserProfile.LoginName, w.UserProfile.DisplayName, nil
}
