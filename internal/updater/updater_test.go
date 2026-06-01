package updater

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompareSemver(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"1.2.3", "1.2.3", 0},
		{"1.2.4", "1.2.3", 1},
		{"1.2.3", "1.2.4", -1},
		{"1.3.0", "1.2.9", 1},
		{"2.0.0", "1.9.9", 1},
		{"v1.2.3", "1.2.3", 0},
		{"1.2.3", "v1.2.3", 0},
		// prerelease precedence: release > prerelease of same core
		{"1.2.3", "1.2.3-beta.1", 1},
		{"1.2.3-beta.1", "1.2.3", -1},
		{"0.0.1-beta.25", "0.0.1-beta.24", 1},
		{"0.0.1-beta.24", "0.0.1-beta.25", -1},
		{"0.0.1-beta.24", "0.0.1-beta.24", 0},
		// numeric identifiers compare as ints, not strings
		{"1.0.0-beta.10", "1.0.0-beta.9", 1},
		// build metadata ignored
		{"1.2.3+abc", "1.2.3+def", 0},
		// fewer prerelease fields < more
		{"1.0.0-beta", "1.0.0-beta.1", -1},
	}
	for _, tt := range tests {
		if got := compareSemver(tt.a, tt.b); got != tt.want {
			t.Errorf("compareSemver(%q,%q)=%d want %d", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestIsDevDetectsLocalBuilds(t *testing.T) {
	dev := []string{
		"dev",
		"",
		"v0.0.1-beta.24-3-gd7e8bf2-dirty",
		"v0.0.1-beta.24-3-gd7e8bf2",
		"0.0.1-beta.24-dirty",
	}
	for _, v := range dev {
		if !New(v).isDev() {
			t.Errorf("isDev(%q)=false, want true", v)
		}
	}
	release := []string{
		"v0.0.1-beta.24",
		"0.0.1-beta.24",
		"1.2.3",
		"v1.2.3",
	}
	for _, v := range release {
		if New(v).isDev() {
			t.Errorf("isDev(%q)=true, want false", v)
		}
	}
}

func TestInfoDevNoUpdate(t *testing.T) {
	c := New("dev")
	info, err := c.Check(context.Background())
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if info.HasUpdate {
		t.Errorf("dev build should never report an update")
	}
	if info.Current != "dev" {
		t.Errorf("Current=%q want dev", info.Current)
	}
	if info.CheckedAt == "" {
		t.Errorf("CheckedAt should be stamped even for dev")
	}
}

func TestCheckHasUpdate(t *testing.T) {
	npm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"dist-tags":{"beta":"0.0.1-beta.25","latest":"0.0.1-beta.20"}}`))
	}))
	defer npm.Close()
	gh := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"body":"## v0.0.1-beta.25\n- fix things","html_url":"https://example/release"}`))
	}))
	defer gh.Close()

	c := New("0.0.1-beta.24")
	c.npmURL = npm.URL
	c.githubAPI = gh.URL

	info, err := c.Check(context.Background())
	if err != nil {
		t.Fatalf("Check err: %v", err)
	}
	if !info.HasUpdate {
		t.Fatalf("expected HasUpdate true, got %+v", info)
	}
	if info.Latest != "0.0.1-beta.25" {
		t.Errorf("Latest=%q want 0.0.1-beta.25", info.Latest)
	}
	if info.Changelog == "" || info.ChangelogURL == "" {
		t.Errorf("expected changelog populated, got %+v", info)
	}
	// Cached Info() should match.
	if c.Info().Latest != info.Latest {
		t.Errorf("cached Info() not updated")
	}
}

func TestCheckUpToDate(t *testing.T) {
	npm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"dist-tags":{"beta":"0.0.1-beta.24"}}`))
	}))
	defer npm.Close()
	// GitHub should not be needed when up to date; fail loudly if hit.
	gh := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("github should not be queried when up to date")
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer gh.Close()

	c := New("0.0.1-beta.24")
	c.npmURL = npm.URL
	c.githubAPI = gh.URL

	info, err := c.Check(context.Background())
	if err != nil {
		t.Fatalf("Check err: %v", err)
	}
	if info.HasUpdate {
		t.Errorf("expected no update, got %+v", info)
	}
}
