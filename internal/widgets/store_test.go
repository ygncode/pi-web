package widgets

import (
	"sync"
	"testing"
)

func TestStore_SetAndGet(t *testing.T) {
	s := NewStore()
	w := s.Set("sess-1", "todos", []string{"3 pending", "1 done"}, "belowEditor")
	if w.Key != "todos" {
		t.Errorf("Key = %q, want todos", w.Key)
	}
	if w.Placement != "belowEditor" {
		t.Errorf("Placement = %q, want belowEditor", w.Placement)
	}

	state := s.Get("sess-1")
	if len(state) != 1 {
		t.Fatalf("len(state) = %d, want 1", len(state))
	}
	if state["todos"].Lines[0] != "3 pending" {
		t.Errorf("unexpected lines: %v", state["todos"].Lines)
	}
}

func TestStore_DefaultPlacement(t *testing.T) {
	s := NewStore()
	w := s.Set("sess-1", "x", []string{"a"}, "")
	if w.Placement != "belowEditor" {
		t.Errorf("default placement = %q, want belowEditor", w.Placement)
	}
}

func TestStore_Replace(t *testing.T) {
	s := NewStore()
	s.Set("sess-1", "todos", []string{"3 pending"}, "belowEditor")
	s.Set("sess-1", "todos", []string{"2 pending", "1 done"}, "belowEditor")
	state := s.Get("sess-1")
	if len(state["todos"].Lines) != 2 {
		t.Errorf("expected 2 lines after replace, got %d", len(state["todos"].Lines))
	}
	if state["todos"].Lines[0] != "2 pending" {
		t.Errorf("replace did not update lines: %v", state["todos"].Lines)
	}
}

func TestStore_Remove(t *testing.T) {
	s := NewStore()
	s.Set("sess-1", "todos", []string{"a"}, "belowEditor")
	if !s.Remove("sess-1", "todos") {
		t.Error("Remove returned false for existing key")
	}
	if s.Remove("sess-1", "todos") {
		t.Error("Remove returned true for already-removed key")
	}
	if state := s.Get("sess-1"); state != nil {
		t.Errorf("expected nil snapshot after last remove, got %v", state)
	}
}

func TestStore_GetReturnsCopies(t *testing.T) {
	s := NewStore()
	s.Set("sess-1", "k", []string{"a", "b"}, "belowEditor")
	state := s.Get("sess-1")
	// Mutate the copy; the store should retain its own snapshot.
	state["k"].Lines[0] = "mutated"
	fresh := s.Get("sess-1")
	if fresh["k"].Lines[0] != "a" {
		t.Errorf("store returned a shared slice — caller mutation leaked: %v", fresh["k"].Lines)
	}
}

func TestStore_PerSessionIsolation(t *testing.T) {
	s := NewStore()
	s.Set("sess-a", "k", []string{"a"}, "belowEditor")
	s.Set("sess-b", "k", []string{"b"}, "aboveEditor")
	a := s.Get("sess-a")
	b := s.Get("sess-b")
	if a["k"].Lines[0] != "a" || b["k"].Lines[0] != "b" {
		t.Errorf("sessions leaked: a=%v b=%v", a, b)
	}
	if a["k"].Placement != "belowEditor" || b["k"].Placement != "aboveEditor" {
		t.Errorf("placement leaked: a=%s b=%s", a["k"].Placement, b["k"].Placement)
	}
}

func TestStore_ClearSession(t *testing.T) {
	s := NewStore()
	s.Set("sess-a", "x", []string{"a"}, "belowEditor")
	s.Set("sess-a", "y", []string{"b"}, "belowEditor")
	s.Set("sess-b", "x", []string{"c"}, "belowEditor")
	s.ClearSession("sess-a")
	if s.Get("sess-a") != nil {
		t.Error("ClearSession did not drop sess-a")
	}
	if s.Get("sess-b") == nil {
		t.Error("ClearSession also dropped sess-b")
	}
}

func TestStore_ConcurrentSetGetIsSafe(t *testing.T) {
	s := NewStore()
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(2)
		go func(i int) { defer wg.Done(); s.Set("sess", "k", []string{"v"}, "belowEditor"); _ = i }(i)
		go func() { defer wg.Done(); _ = s.Get("sess") }()
	}
	wg.Wait()
	// Survived the race detector — that's the assertion.
}
