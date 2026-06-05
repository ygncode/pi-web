package frontend

import (
	"testing"
	"testing/fstest"
)

func TestLoadFrontendScriptsSingleEntrypoint(t *testing.T) {
	fsys := fstest.MapFS{
		".vite/manifest.json": &fstest.MapFile{
			Data: []byte(`{"src/index/index.js":{"file":"assets/index-abc123.js"}}`),
		},
		"assets/index-abc123.js": &fstest.MapFile{Data: []byte("console.log('hello')")},
	}
	scripts, err := loadFrontendScripts(fsys, indexEntry)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(scripts) != 1 {
		t.Fatalf("len(scripts) = %d, want 1", len(scripts))
	}
	if scripts[0].Path != "/static/assets/index-abc123.js" {
		t.Errorf("path = %q, want %q", scripts[0].Path, "/static/assets/index-abc123.js")
	}
	if scripts[0].JS != "console.log('hello')" {
		t.Errorf("js = %q, want %q", scripts[0].JS, "console.log('hello')")
	}
}

func TestLoadFrontendScriptsLoadsMultipleEntrypoints(t *testing.T) {
	fsys := fstest.MapFS{
		".vite/manifest.json": &fstest.MapFile{
			Data: []byte(`{"src/main.js":{"file":"assets/app-000111.js"},"src/index/index.js":{"file":"assets/index-abc123.js"},"src/session/session.js":{"file":"assets/session-def456.js"},"src/live/live.js":{"file":"assets/live-ghi789.js"}}`),
		},
		"assets/app-000111.js":     &fstest.MapFile{Data: []byte("app")},
		"assets/index-abc123.js":   &fstest.MapFile{Data: []byte("index")},
		"assets/session-def456.js": &fstest.MapFile{Data: []byte("session")},
		"assets/live-ghi789.js":    &fstest.MapFile{Data: []byte("live")},
	}
	scripts, err := loadFrontendScripts(fsys, appEntry, "src/index/index.js", "src/session/session.js", "src/live/live.js")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(scripts) != 4 {
		t.Fatalf("len(scripts) = %d, want 4", len(scripts))
	}
	checks := []struct {
		path string
		js   string
	}{
		{"/static/assets/app-000111.js", "app"},
		{"/static/assets/index-abc123.js", "index"},
		{"/static/assets/session-def456.js", "session"},
		{"/static/assets/live-ghi789.js", "live"},
	}
	for i, check := range checks {
		if scripts[i].Path != check.path || scripts[i].JS != check.js {
			t.Fatalf("scripts[%d] = (%q, %q), want (%q, %q)", i, scripts[i].Path, scripts[i].JS, check.path, check.js)
		}
	}
}

func TestLoadFrontendScriptsMissingManifest(t *testing.T) {
	if _, err := loadFrontendScripts(fstest.MapFS{}, indexEntry); err == nil {
		t.Fatal("expected error for missing manifest")
	}
}

func TestLoadFrontendScriptsEmptyFile(t *testing.T) {
	fsys := fstest.MapFS{
		".vite/manifest.json": &fstest.MapFile{
			Data: []byte(`{"src/index/index.js":{"file":""}}`),
		},
	}
	if _, err := loadFrontendScripts(fsys, indexEntry); err == nil {
		t.Fatal("expected error for empty file")
	}
}

func TestLoadFrontendScriptsAbsolutePath(t *testing.T) {
	fsys := fstest.MapFS{
		".vite/manifest.json": &fstest.MapFile{
			Data: []byte(`{"src/index/index.js":{"file":"/etc/passwd"}}`),
		},
	}
	if _, err := loadFrontendScripts(fsys, indexEntry); err == nil {
		t.Fatal("expected error for absolute path")
	}
}

func TestLoadFrontendScriptsPathTraversal(t *testing.T) {
	fsys := fstest.MapFS{
		".vite/manifest.json": &fstest.MapFile{
			Data: []byte(`{"src/index/index.js":{"file":"../etc/passwd"}}`),
		},
	}
	if _, err := loadFrontendScripts(fsys, indexEntry); err == nil {
		t.Fatal("expected error for path traversal")
	}
}
