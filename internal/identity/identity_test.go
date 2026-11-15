package identity

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"
)

func TestIdentifyServeHeaderOnlyFromLoopback(t *testing.T) {
	// Header trust is off by default.
	off := &Resolver{}
	r0 := httptest.NewRequest("GET", "/", nil)
	r0.RemoteAddr = "127.0.0.1:5555"
	r0.Header.Set("Tailscale-User-Login", "ana@symetrix.com")
	if u := off.Identify(r0); u.Known() {
		t.Fatalf("header trusted without TrustServeHeaders: %+v", u)
	}
	res := &Resolver{TrustServeHeaders: true}
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "127.0.0.1:5555"
	r.Header.Set("Tailscale-User-Login", "Ana@Symetrix.com")
	r.Header.Set("Tailscale-User-Name", "Ana Lima")
	u := res.Identify(r)
	if u.Login != "ana@symetrix.com" || u.Name != "Ana Lima" || u.Short != "ana" || u.Via != "serve-header" {
		t.Fatalf("unexpected user %+v", u)
	}
	// Spoofed header from a non-loopback peer must be ignored.
	r2 := httptest.NewRequest("GET", "/", nil)
	r2.RemoteAddr = "192.168.1.9:5555"
	r2.Header.Set("Tailscale-User-Login", "boss@symetrix.com")
	if u := res.Identify(r2); u.Known() {
		t.Fatalf("spoofed header accepted: %+v", u)
	}
}

func TestIdentifyWhoisAndCache(t *testing.T) {
	calls := 0
	res := &Resolver{Whois: func(ctx context.Context, ip string) (string, string, error) {
		calls++
		if ip != "100.70.165.106" {
			t.Fatalf("ip %s", ip)
		}
		return "vinicius@symetrixtrading.com", "Vinicius", nil
	}}
	for i := 0; i < 3; i++ {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = "100.70.165.106:1234"
		r.Header.Set("Tailscale-User-Login", "ignored@x.com")
		u := res.Identify(r)
		if u.Short != "vinicius" || u.Via != "whois" {
			t.Fatalf("unexpected %+v", u)
		}
	}
	if calls != 1 {
		t.Fatalf("whois called %d times, want 1 (cached)", calls)
	}
}

func TestIdentifyFallbackAndTagged(t *testing.T) {
	res := &Resolver{Fallback: "symetrix", Whois: func(context.Context, string) (string, string, error) {
		return "tagged-devices", "", nil
	}}
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "100.89.162.73:1"
	if u := res.Identify(r); u.Via != "fallback" || u.Login != "symetrix" {
		t.Fatalf("tagged device should fall back: %+v", u)
	}
	res.Whois = func(context.Context, string) (string, string, error) { return "", "", errors.New("x") }
	if u := res.Identify(r); u.Via != "fallback" {
		t.Fatalf("whois error should fall back: %+v", u)
	}
	res.Fallback = ""
	if u := res.Identify(r); u.Known() {
		t.Fatalf("want anonymous, got %+v", u)
	}
}

func TestParseWhoisJSON(t *testing.T) {
	l, n, err := ParseWhoisJSON([]byte(`{"Node":{},"UserProfile":{"LoginName":"a@b.c","DisplayName":"A B"}}`))
	if err != nil || l != "a@b.c" || n != "A B" {
		t.Fatalf("%q %q %v", l, n, err)
	}
}
