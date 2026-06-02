package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"

	"pi-web/internal/agentdir"
)

// PushManager owns the VAPID key pair and the set of browser push
// subscriptions. Subscriptions are persisted as JSON on disk so they
// survive restarts; one file under ~/.pi/agent/web/.
type PushManager struct {
	mu        sync.Mutex
	publicKey string
	privateKey string
	subject   string
	storeDir  string
	subs      map[string]pushSub
	client    *http.Client
}

type pushSub struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

type vapidFile struct {
	PublicKey  string `json:"publicKey"`
	PrivateKey string `json:"privateKey"`
}

// NewPushManager loads/creates VAPID keys and subscription store under
// <agentDir>/pi-web/. Returns a manager ready to register HTTP handlers.
func NewPushManager(agentDir string) (*PushManager, error) {
	dir := agentdir.WebDir(agentDir)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}

	// Migrate old push data from pre-pi-web directory layout.
	oldDir := filepath.Join(agentDir, "web")
	if info, err := os.Stat(oldDir); err == nil && info.IsDir() {
		for _, name := range []string{"vapid.json", "push-subs.json"} {
			oldPath := filepath.Join(oldDir, name)
			newPath := filepath.Join(dir, name)
			if _, err := os.Stat(oldPath); err == nil {
				if _, err := os.Stat(newPath); os.IsNotExist(err) {
					_ = os.Rename(oldPath, newPath)
				}
			}
		}
		_ = os.Remove(oldDir)
	}

	m := &PushManager{
		storeDir: dir,
		subs:     make(map[string]pushSub),
		subject:  "mailto:pi-web@local",
		client:   &http.Client{Timeout: 10 * time.Second},
	}
	if err := m.loadOrCreateKeys(); err != nil {
		return nil, err
	}
	m.loadSubs()
	return m, nil
}

func (m *PushManager) loadOrCreateKeys() error {
	path := filepath.Join(m.storeDir, "vapid.json")
	data, err := os.ReadFile(path)
	if err == nil {
		var v vapidFile
		if json.Unmarshal(data, &v) == nil && v.PublicKey != "" && v.PrivateKey != "" {
			m.publicKey = v.PublicKey
			m.privateKey = v.PrivateKey
			return nil
		}
	}
	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		return fmt.Errorf("generate VAPID keys: %w", err)
	}
	m.publicKey = pub
	m.privateKey = priv
	out, _ := json.Marshal(vapidFile{PublicKey: pub, PrivateKey: priv})
	return os.WriteFile(path, out, 0600)
}

func (m *PushManager) subsPath() string {
	return filepath.Join(m.storeDir, "push-subs.json")
}

func (m *PushManager) loadSubs() {
	data, err := os.ReadFile(m.subsPath())
	if err != nil {
		return
	}
	var subs map[string]pushSub
	if json.Unmarshal(data, &subs) != nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.subs = subs
	if m.subs == nil {
		m.subs = make(map[string]pushSub)
	}
}

func (m *PushManager) saveSubsLocked() {
	out, _ := json.MarshalIndent(m.subs, "", "  ")
	_ = os.WriteFile(m.subsPath(), out, 0600)
}

func (m *PushManager) PublicKey() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.publicKey
}

// Register installs the /api/push/* handlers on mux behind auth.
func (m *PushManager) Register(mux *http.ServeMux, auth func(http.HandlerFunc) http.HandlerFunc) {
	mux.HandleFunc("/api/push/vapid", auth(m.handleVapid))
	mux.HandleFunc("/api/push/subscribe", auth(m.handleSubscribe))
	mux.HandleFunc("/api/push/unsubscribe", auth(m.handleUnsubscribe))
}

func (m *PushManager) handleVapid(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 0, map[string]any{"publicKey": m.PublicKey()})
}

func (m *PushManager) handleSubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var sub pushSub
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil || sub.Endpoint == "" {
		http.Error(w, "invalid subscription", http.StatusBadRequest)
		return
	}
	m.mu.Lock()
	m.subs[sub.Endpoint] = sub
	m.saveSubsLocked()
	m.mu.Unlock()
	writeJSON(w, 0, map[string]any{"ok": true})
}

func (m *PushManager) handleUnsubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Endpoint string `json:"endpoint"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Endpoint == "" {
		http.Error(w, "invalid endpoint", http.StatusBadRequest)
		return
	}
	m.mu.Lock()
	delete(m.subs, body.Endpoint)
	m.saveSubsLocked()
	m.mu.Unlock()
	writeJSON(w, 0, map[string]any{"ok": true})
}

// NotifyDone sends a push to every registered subscription. Failed endpoints
// (gone / 410) are pruned. Best-effort: errors are logged to stderr.
func (m *PushManager) NotifyDone(sessionID string) {
	if m == nil {
		return
	}
	m.mu.Lock()
	if len(m.subs) == 0 {
		m.mu.Unlock()
		return
	}
	subs := make([]pushSub, 0, len(m.subs))
	for _, s := range m.subs {
		subs = append(subs, s)
	}
	pub := m.publicKey
	priv := m.privateKey
	subj := m.subject
	m.mu.Unlock()

	payload, _ := json.Marshal(map[string]string{
		"type":      "session-done",
		"sessionId": sessionID,
		"title":     "pi session",
		"body":      "Response ready",
	})

	var stale []string
	for _, s := range subs {
		ws := &webpush.Subscription{
			Endpoint: s.Endpoint,
			Keys:     webpush.Keys{P256dh: s.Keys.P256dh, Auth: s.Keys.Auth},
		}
		resp, err := webpush.SendNotification(payload, ws, &webpush.Options{
			HTTPClient:      m.client,
			Subscriber:      subj,
			VAPIDPublicKey:  pub,
			VAPIDPrivateKey: priv,
			TTL:             60,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "push send failed: %v\n", err)
			continue
		}
		if resp != nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
				stale = append(stale, s.Endpoint)
			}
		}
	}
	if len(stale) > 0 {
		m.mu.Lock()
		for _, e := range stale {
			delete(m.subs, e)
		}
		m.saveSubsLocked()
		m.mu.Unlock()
	}
}
