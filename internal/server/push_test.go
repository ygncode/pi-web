package server

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewPushManager_CreatesDirUnderAgentPath(t *testing.T) {
	tmp := t.TempDir()
	pm, err := NewPushManager(tmp)
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(tmp, "pi-web")
	if pm.storeDir != want {
		t.Fatalf("storeDir = %s, want %s", pm.storeDir, want)
	}
	if _, err := os.Stat(pm.storeDir); err != nil {
		t.Fatalf("dir not created: %v", err)
	}
}

func TestNewPushManager_PersistsVapidKeys(t *testing.T) {
	tmp := t.TempDir()
	pm1, err := NewPushManager(tmp)
	if err != nil {
		t.Fatal(err)
	}
	pub1 := pm1.PublicKey()
	if pub1 == "" {
		t.Fatal("expected non-empty public key")
	}

	// Second instance should load existing keys
	pm2, err := NewPushManager(tmp)
	if err != nil {
		t.Fatal(err)
	}
	if pm2.PublicKey() != pub1 {
		t.Fatal("expected same public key after reload")
	}
}

func TestNewPushManager_MigratesOldWebDir(t *testing.T) {
	tmp := t.TempDir()
	oldDir := filepath.Join(tmp, "web")
	newDir := filepath.Join(tmp, "pi-web")

	if err := os.MkdirAll(oldDir, 0700); err != nil {
		t.Fatal(err)
	}
	// Write old VAPID keys
	oldVapid := []byte(`{"publicKey":"pub","privateKey":"priv"}`)
	if err := os.WriteFile(filepath.Join(oldDir, "vapid.json"), oldVapid, 0600); err != nil {
		t.Fatal(err)
	}
	// Write old subscriptions
	oldSubs := []byte(`{"sub1":{"endpoint":"e","keys":{"p256dh":"p","auth":"a"}}}`)
	if err := os.WriteFile(filepath.Join(oldDir, "push-subs.json"), oldSubs, 0600); err != nil {
		t.Fatal(err)
	}

	pm, err := NewPushManager(tmp)
	if err != nil {
		t.Fatal(err)
	}
	if pm.storeDir != newDir {
		t.Fatalf("storeDir = %s, want %s", pm.storeDir, newDir)
	}
	if _, err := os.Stat(oldDir); !os.IsNotExist(err) {
		t.Fatal("old web dir should have been removed")
	}
	if pm.PublicKey() != "pub" {
		t.Fatalf("expected migrated public key pub, got %s", pm.PublicKey())
	}
}
