package schedules

import (
	"database/sql"
	"errors"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	for _, ddl := range []string{SchedulesTableDDL, RunsTableDDL, RunsScheduleIndexDDL, RunsSessionIndexDDL} {
		if _, err := db.Exec(ddl); err != nil {
			t.Fatalf("create schema: %v", err)
		}
	}
	t.Cleanup(func() { db.Close() })
	return NewStore(db)
}

func TestValidateCron(t *testing.T) {
	tests := []struct {
		expr    string
		wantErr bool
	}{
		{"", false},
		{"0 9 * * *", false},
		{"0 9 * * 1-5", false},
		{"*/15 * * * *", false},
		{"bogus", true},
		{"0 9 * *", true},
		{"99 9 * * *", true},
	}
	for _, tc := range tests {
		err := ValidateCron(tc.expr)
		if (err != nil) != tc.wantErr {
			t.Errorf("ValidateCron(%q) err=%v, wantErr=%v", tc.expr, err, tc.wantErr)
		}
	}
}

func TestNextFire(t *testing.T) {
	base := time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC)

	t.Run("manual returns ErrManual", func(t *testing.T) {
		_, err := NextFire("", "", base)
		if !errors.Is(err, ErrManual) {
			t.Fatalf("want ErrManual, got %v", err)
		}
	})

	t.Run("daily in UTC", func(t *testing.T) {
		next, err := NextFire("0 9 * * *", "UTC", base)
		if err != nil {
			t.Fatal(err)
		}
		want := time.Date(2026, 6, 15, 9, 0, 0, 0, time.UTC)
		if !next.Equal(want) {
			t.Errorf("next = %v, want %v", next, want)
		}
	})

	t.Run("respects timezone", func(t *testing.T) {
		// 09:00 in New York is 13:00 UTC (EDT in June).
		next, err := NextFire("0 9 * * *", "America/New_York", base)
		if err != nil {
			t.Fatal(err)
		}
		if got := next.UTC().Hour(); got != 13 {
			t.Errorf("next UTC hour = %d, want 13", got)
		}
	})

	t.Run("invalid timezone", func(t *testing.T) {
		if _, err := NextFire("0 9 * * *", "Mars/Phobos", base); err == nil {
			t.Fatal("want error for bad timezone")
		}
	})
}

func TestStoreCRUD(t *testing.T) {
	st := newTestStore(t)
	fixed := time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC)
	st.Now = func() time.Time { return fixed }

	created, err := st.Create(Schedule{
		ID:           "abc",
		Name:         "Digest",
		Instructions: "summarize",
		CronExpr:     "0 9 * * *",
		Timezone:     "UTC",
		Enabled:      true,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created.CreatedAt == "" || created.UpdatedAt == "" {
		t.Error("timestamps not stamped")
	}

	got, err := st.Get("abc")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Name != "Digest" || !got.Enabled {
		t.Errorf("unexpected schedule: %+v", got)
	}

	got.Name = "Renamed"
	got.Enabled = false
	if _, err := st.Update(got); err != nil {
		t.Fatalf("update: %v", err)
	}
	reread, _ := st.Get("abc")
	if reread.Name != "Renamed" || reread.Enabled {
		t.Errorf("update not persisted: %+v", reread)
	}

	list, err := st.List()
	if err != nil || len(list) != 1 {
		t.Fatalf("list = %v (err %v)", list, err)
	}

	if err := st.Delete("abc"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := st.Get("abc"); !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("want ErrNoRows after delete, got %v", err)
	}
}

func TestRunLifecycleAndSessionMapping(t *testing.T) {
	st := newTestStore(t)
	if _, err := st.Create(Schedule{ID: "s1", Name: "Nightly", Instructions: "x", Enabled: true}); err != nil {
		t.Fatal(err)
	}

	runID, err := st.RecordRun(Run{
		ScheduleID: "s1",
		FiredAt:    time.Now().UTC().Format(time.RFC3339),
		Status:     RunStatusRunning,
	})
	if err != nil {
		t.Fatalf("record run: %v", err)
	}
	if err := st.AttachSession(runID, "session-uuid", "file.jsonl"); err != nil {
		t.Fatalf("attach: %v", err)
	}

	name, ok := st.ScheduleNameForSession("session-uuid")
	if !ok || name != "Nightly" {
		t.Errorf("ScheduleNameForSession = %q, %v; want Nightly, true", name, ok)
	}
	if _, ok := st.ScheduleNameForSession("unknown"); ok {
		t.Error("unknown session should not map to a schedule")
	}

	runs, err := st.ListRuns("s1", 10)
	if err != nil || len(runs) != 1 {
		t.Fatalf("ListRuns = %v (err %v)", runs, err)
	}
	if runs[0].SessionID != "session-uuid" {
		t.Errorf("run session = %q", runs[0].SessionID)
	}

	if err := st.FailRun(runID, "boom"); err != nil {
		t.Fatalf("fail run: %v", err)
	}
	runs, _ = st.ListRuns("s1", 10)
	if runs[0].Status != RunStatusError || runs[0].Error != "boom" {
		t.Errorf("fail not persisted: %+v", runs[0])
	}
}
