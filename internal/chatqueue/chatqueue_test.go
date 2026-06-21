package chatqueue

import (
	"database/sql"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	db.SetMaxOpenConns(1)
	for _, stmt := range []string{ItemsTableDDL, ItemsSessionIndexDDL, StateTableDDL} {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("apply schema: %v", err)
		}
	}
	fixed := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s := NewStore(db)
	s.Now = func() time.Time { return fixed }
	return s
}

func TestAddListRemove(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.Add("sess-1", "hello", "hello"); err != nil {
		t.Fatalf("Add hello: %v", err)
	}
	if _, err := s.Add("sess-1", "world", "world"); err != nil {
		t.Fatalf("Add world: %v", err)
	}
	snap, err := s.List("sess-1")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(snap.Items) != 2 {
		t.Fatalf("want 2 items, got %d", len(snap.Items))
	}
	if snap.Items[0].Position != 1 || snap.Items[1].Position != 2 {
		t.Fatalf("positions not monotonic: %#v", snap.Items)
	}
	if snap.Paused {
		t.Fatalf("expected paused=false")
	}

	if err := s.Remove("sess-1", 1); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	snap, _ = s.List("sess-1")
	if len(snap.Items) != 1 || snap.Items[0].Message != "world" {
		t.Fatalf("after remove: %#v", snap.Items)
	}
}

func TestPositionsAreNotReused(t *testing.T) {
	s := newTestStore(t)
	a, _ := s.Add("sess-1", "a", "a")
	if err := s.Remove("sess-1", a.Position); err != nil {
		t.Fatalf("remove a: %v", err)
	}
	b, err := s.Add("sess-1", "b", "b")
	if err != nil {
		t.Fatalf("Add b: %v", err)
	}
	if b.Position <= a.Position {
		t.Fatalf("expected new position > %d, got %d", a.Position, b.Position)
	}
}

func TestPopHead(t *testing.T) {
	s := newTestStore(t)
	if _, ok, _ := s.PopHead("sess-1"); ok {
		t.Fatalf("expected empty pop")
	}
	s.Add("sess-1", "one", "one")
	s.Add("sess-1", "two", "two")
	item, ok, err := s.PopHead("sess-1")
	if err != nil || !ok || item.Message != "one" {
		t.Fatalf("PopHead 1: ok=%v err=%v item=%#v", ok, err, item)
	}
	item, ok, err = s.PopHead("sess-1")
	if err != nil || !ok || item.Message != "two" {
		t.Fatalf("PopHead 2: ok=%v err=%v item=%#v", ok, err, item)
	}
	if _, ok, _ := s.PopHead("sess-1"); ok {
		t.Fatalf("expected empty pop after drain")
	}
}

func TestPauseRoundtrip(t *testing.T) {
	s := newTestStore(t)
	snap, _ := s.List("sess-1")
	if snap.Paused {
		t.Fatalf("default paused must be false")
	}
	if err := s.SetPaused("sess-1", true); err != nil {
		t.Fatalf("SetPaused true: %v", err)
	}
	snap, _ = s.List("sess-1")
	if !snap.Paused {
		t.Fatalf("expected paused=true after SetPaused")
	}
	if err := s.SetPaused("sess-1", false); err != nil {
		t.Fatalf("SetPaused false: %v", err)
	}
	snap, _ = s.List("sess-1")
	if snap.Paused {
		t.Fatalf("expected paused=false after toggle")
	}
}

func TestSessionsWithItemsSkipsPaused(t *testing.T) {
	s := newTestStore(t)
	s.Add("active", "a", "a")
	s.Add("paused-with-items", "b", "b")
	s.SetPaused("paused-with-items", true)
	s.SetPaused("paused-empty", true) // paused but no items — should not appear

	ids, err := s.SessionsWithItems()
	if err != nil {
		t.Fatalf("SessionsWithItems: %v", err)
	}
	if len(ids) != 1 || ids[0] != "active" {
		t.Fatalf("expected [active], got %#v", ids)
	}
}

func TestSessionsIsolated(t *testing.T) {
	s := newTestStore(t)
	s.Add("A", "a-1", "a-1")
	s.Add("B", "b-1", "b-1")
	s.Add("A", "a-2", "a-2")

	a, _ := s.List("A")
	if len(a.Items) != 2 || a.Items[0].Message != "a-1" || a.Items[1].Message != "a-2" {
		t.Fatalf("session A snapshot wrong: %#v", a.Items)
	}
	b, _ := s.List("B")
	if len(b.Items) != 1 || b.Items[0].Message != "b-1" {
		t.Fatalf("session B snapshot wrong: %#v", b.Items)
	}
}

func TestClearDropsItemsAndPause(t *testing.T) {
	s := newTestStore(t)
	s.Add("X", "x", "x")
	s.SetPaused("X", true)
	if err := s.Clear("X"); err != nil {
		t.Fatalf("Clear: %v", err)
	}
	snap, _ := s.List("X")
	if len(snap.Items) != 0 || snap.Paused {
		t.Fatalf("after Clear: %#v", snap)
	}
}

func TestAddRejectsEmptyMessage(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.Add("sess", "", ""); err == nil {
		t.Fatalf("expected error for empty message")
	}
}

func TestRemoveMissingIsNoop(t *testing.T) {
	s := newTestStore(t)
	if err := s.Remove("sess", 99); err != nil {
		t.Fatalf("remove missing should be no-op, got %v", err)
	}
}
