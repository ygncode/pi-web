package frontend

import (
	"testing"
	"testing/fstest"
)

func TestLoadFrontendScriptsSingleEntrypoint(t *testing.T) {
	fsys := fstest.MapFS{
		".vite/manifest.json": &fstest.MapFile{
			Data: []byte(`{"src/main.js":{"file":"assets/app-abc123.js"}}`),
		},
		"assets/app-abc123.js": &fstest.MapFile{Data: []byte("console.log('hello')")},
	}
	scripts, err := loadFrontendScripts(fsys, appEntry)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(scripts) != 1 {
		t.Fatalf("len(scripts) = %d, want 1", len(scripts))
	}
	if scripts[0].Path != "/static/assets/app-abc123.js" {
		t.Errorf("path = %q, want %q", scripts[0].Path, "/static/assets/app-abc123.js")
	}
	if scripts[0].JS != "console.log('hello')" {
		t.Errorf("js = %q, want %q", scripts[0].JS, "console.log('hello')")
	}
}

func TestLoadFrontendScriptsLoadsMultipleEntrypoints(t *testing.T) {
	fsys := fstest.MapFS{
		".vite/manifest.json": &fstest.MapFile{
			Data: []byte(`{"src/main.js":{"file":"assets/app-000111.js"},"src/other.js":{"file":"assets/other-222333.js"}}`),
		},
		"assets/app-000111.js":   &fstest.MapFile{Data: []byte("app")},
		"assets/other-222333.js": &fstest.MapFile{Data: []byte("other")},
	}
	scripts, err := loadFrontendScripts(fsys, appEntry, "src/other.js")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(scripts) != 2 {
		t.Fatalf("len(scripts) = %d, want 2", len(scripts))
	}
	checks := []struct {
		path string
		js   string
	}{
		{"/static/assets/app-000111.js", "app"},
		{"/static/assets/other-222333.js", "other"},
	}
	for i, check := range checks {
		if scripts[i].Path != check.path || scripts[i].JS != check.js {
			t.Fatalf("scripts[%d] = (%q, %q), want (%q, %q)", i, scripts[i].Path, scripts[i].JS, check.path, check.js)
		}
	}
}

func TestLoadFrontendScriptsMissingManifest(t *testing.T) {
	if _, err := loadFrontendScripts(fstest.MapFS{}, appEntry); err == nil {
		t.Fatal("expected error for missing manifest")
	}
}

func TestLoadFrontendScriptsEmptyFile(t *testing.T) {
	fsys := fstest.MapFS{
		".vite/manifest.json": &fstest.MapFile{
			Data: []byte(`{"src/main.js":{"file":""}}`),
		},
	}
	if _, err := loadFrontendScripts(fsys, appEntry); err == nil {
		t.Fatal("expected error for empty file")
	}
}

func TestLoadFrontendScriptsAbsolutePath(t *testing.T) {
	fsys := fstest.MapFS{
		".vite/manifest.json": &fstest.MapFile{
			Data: []byte(`{"src/main.js":{"file":"/etc/passwd"}}`),
		},
	}
	if _, err := loadFrontendScripts(fsys, appEntry); err == nil {
		t.Fatal("expected error for absolute path")
	}
}

func TestLoadFrontendScriptsPathTraversal(t *testing.T) {
	fsys := fstest.MapFS{
		".vite/manifest.json": &fstest.MapFile{
			Data: []byte(`{"src/main.js":{"file":"../etc/passwd"}}`),
		},
	}
	if _, err := loadFrontendScripts(fsys, appEntry); err == nil {
		t.Fatal("expected error for path traversal")
	}
}
