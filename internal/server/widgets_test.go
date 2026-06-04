package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"pi-web/internal/widgets"
)

func TestHandleApiWidgets_MissingSession(t *testing.T) {
	s := &Server{widgets: widgets.NewStore()}
	req := httptest.NewRequest(http.MethodGet, "/api/widgets", nil)
	w := httptest.NewRecorder()
	s.handleApiWidgets(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing session param, got %d", w.Code)
	}
}

func TestHandleApiWidgets_NilStore(t *testing.T) {
	// When the store wasn't wired (tests, --no-extensions builds), the endpoint
	// should return an empty list rather than 500.
	s := &Server{}
	req := httptest.NewRequest(http.MethodGet, "/api/widgets?session=s", nil)
	w := httptest.NewRecorder()
	s.handleApiWidgets(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 with nil store, got %d", w.Code)
	}
	var resp struct {
		Widgets []any `json:"widgets"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if len(resp.Widgets) != 0 {
		t.Errorf("expected empty widgets list, got %v", resp.Widgets)
	}
}

func TestHandleApiWidgets_SortedByPlacementThenKey(t *testing.T) {
	store := widgets.NewStore()
	store.Set("s1", "todos", []string{"3 pending"}, "belowEditor")
	store.Set("s1", "goals", []string{"goal A"}, "aboveEditor")
	store.Set("s1", "monitors", []string{"2 monitors"}, "belowEditor")
	store.Set("s1", "memory", []string{"122 facts"}, "aboveEditor")

	s := &Server{widgets: store}
	req := httptest.NewRequest(http.MethodGet, "/api/widgets?session=s1", nil)
	w := httptest.NewRecorder()
	s.handleApiWidgets(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var resp struct {
		Widgets []widgets.Widget `json:"widgets"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Widgets) != 4 {
		t.Fatalf("expected 4 widgets, got %d", len(resp.Widgets))
	}
	// aboveEditor before belowEditor; alpha within each placement.
	wantKeys := []string{"goals", "memory", "monitors", "todos"}
	for i, want := range wantKeys {
		if resp.Widgets[i].Key != want {
			t.Errorf("widgets[%d].Key = %q, want %q (full = %v)", i, resp.Widgets[i].Key, want, keysOf(resp.Widgets))
			break
		}
	}
}

func TestHandleApiWidgets_ScopedBySession(t *testing.T) {
	store := widgets.NewStore()
	store.Set("a", "x", []string{"alpha"}, "belowEditor")
	store.Set("b", "x", []string{"beta"}, "belowEditor")
	s := &Server{widgets: store}

	req := httptest.NewRequest(http.MethodGet, "/api/widgets?session=a", nil)
	rec := httptest.NewRecorder()
	s.handleApiWidgets(rec, req)
	var resp struct {
		Widgets []widgets.Widget `json:"widgets"`
	}
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if len(resp.Widgets) != 1 || resp.Widgets[0].Lines[0] != "alpha" {
		t.Errorf("session=a leaked another session's widgets: %v", resp.Widgets)
	}
}

func keysOf(ws []widgets.Widget) []string {
	out := make([]string, 0, len(ws))
	for _, w := range ws {
		out = append(out, w.Key)
	}
	return out
}
