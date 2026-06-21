// Package schedules persists user-defined automation schedules and the runs
// they trigger. A schedule fires by creating a fresh pi session and sending its
// instructions as the first message; the per-fire mapping in schedule_runs both
// drives the run log and tags which sessions were schedule-created (so the UI
// can filter them and route schedule-specific push notifications).
//
// The store and cron math live here (pure, testable); the ticker loop and the
// session-creating runner live in package server, which owns the chat workers
// and SSE broadcast.
package schedules

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/robfig/cron/v3"
)

// ErrManual is returned by NextFire for a schedule with no cron expression:
// it only ever fires via an explicit Run-now, never on a timer.
var ErrManual = errors.New("schedule is manual")

// SchedulesTableDDL and RunsTableDDL are registered alongside the other schema
// in server.initDB so all table creation stays on one path.
const SchedulesTableDDL = `CREATE TABLE IF NOT EXISTS schedules (
	id             TEXT PRIMARY KEY,
	name           TEXT NOT NULL,
	instructions   TEXT NOT NULL,
	model_provider TEXT NOT NULL DEFAULT '',
	model_id       TEXT NOT NULL DEFAULT '',
	thinking_level TEXT NOT NULL DEFAULT '',
	project_path   TEXT NOT NULL DEFAULT '',
	cron_expr      TEXT NOT NULL DEFAULT '',
	timezone       TEXT NOT NULL DEFAULT '',
	enabled        INTEGER NOT NULL DEFAULT 1,
	last_run_at    DATETIME,
	created_at     DATETIME NOT NULL,
	updated_at     DATETIME NOT NULL
)`

const RunsTableDDL = `CREATE TABLE IF NOT EXISTS schedule_runs (
	id           INTEGER PRIMARY KEY AUTOINCREMENT,
	schedule_id  TEXT NOT NULL,
	session_id   TEXT NOT NULL DEFAULT '',
	session_file TEXT NOT NULL DEFAULT '',
	fired_at     DATETIME NOT NULL,
	status       TEXT NOT NULL,
	error        TEXT NOT NULL DEFAULT ''
)`

const RunsScheduleIndexDDL = `CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule ON schedule_runs(schedule_id, fired_at DESC)`
const RunsSessionIndexDDL = `CREATE INDEX IF NOT EXISTS idx_schedule_runs_session ON schedule_runs(session_id)`

// Run statuses recorded in schedule_runs.status.
const (
	RunStatusRunning = "running"
	RunStatusError   = "error"
)

// Schedule is one automation definition. Empty CronExpr means manual-only.
// Empty model/thinking/project fields fall back to pi defaults / home dir.
type Schedule struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Instructions  string `json:"instructions"`
	ModelProvider string `json:"modelProvider"`
	ModelID       string `json:"modelId"`
	ThinkingLevel string `json:"thinkingLevel"`
	ProjectPath   string `json:"projectPath"`
	CronExpr      string `json:"cronExpr"`
	Timezone      string `json:"timezone"`
	Enabled       bool   `json:"enabled"`
	LastRunAt     string `json:"lastRunAt,omitempty"`
	NextRunAt     string `json:"nextRunAt,omitempty"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
}

// Run is one firing of a schedule, mapping it to the session it created.
type Run struct {
	ID          int64  `json:"id"`
	ScheduleID  string `json:"scheduleId"`
	SessionID   string `json:"sessionId,omitempty"`
	SessionFile string `json:"sessionFile,omitempty"`
	FiredAt     string `json:"firedAt"`
	Status      string `json:"status"`
	Error       string `json:"error,omitempty"`
}

// IsManual reports whether the schedule never fires on a timer.
func (s Schedule) IsManual() bool { return strings.TrimSpace(s.CronExpr) == "" }

// ValidateCron parses a standard 5-field cron expression, returning an error if
// it is malformed. An empty expression is valid (manual schedule).
func ValidateCron(expr string) error {
	if strings.TrimSpace(expr) == "" {
		return nil
	}
	_, err := cron.ParseStandard(expr)
	return err
}

// LoadLocation resolves an IANA timezone name, defaulting to server-local time
// when empty.
func LoadLocation(tz string) (*time.Location, error) {
	if strings.TrimSpace(tz) == "" {
		return time.Local, nil
	}
	return time.LoadLocation(tz)
}

// NextFire returns the next time the schedule should fire strictly after the
// given instant, evaluated in the schedule's timezone. Returns ErrManual for an
// empty cron expression.
func NextFire(cronExpr, tz string, after time.Time) (time.Time, error) {
	if strings.TrimSpace(cronExpr) == "" {
		return time.Time{}, ErrManual
	}
	loc, err := LoadLocation(tz)
	if err != nil {
		return time.Time{}, err
	}
	sched, err := cron.ParseStandard(cronExpr)
	if err != nil {
		return time.Time{}, err
	}
	return sched.Next(after.In(loc)), nil
}

// Store is a thin SQLite-backed repository for schedules and their runs.
type Store struct {
	db  *sql.DB
	Now func() time.Time
}

// NewStore wraps a database handle. The schema must already be created (see the
// *DDL constants, registered in server.initDB).
func NewStore(db *sql.DB) *Store {
	return &Store{db: db, Now: time.Now}
}

func (st *Store) now() time.Time {
	if st.Now != nil {
		return st.Now()
	}
	return time.Now()
}

const scheduleColumns = `id, name, instructions, model_provider, model_id, thinking_level,
	project_path, cron_expr, timezone, enabled, last_run_at, created_at, updated_at`

func scanSchedule(scan func(dest ...any) error) (Schedule, error) {
	var s Schedule
	var enabled int
	var lastRun sql.NullString
	err := scan(&s.ID, &s.Name, &s.Instructions, &s.ModelProvider, &s.ModelID,
		&s.ThinkingLevel, &s.ProjectPath, &s.CronExpr, &s.Timezone, &enabled,
		&lastRun, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return Schedule{}, err
	}
	s.Enabled = enabled != 0
	if lastRun.Valid {
		s.LastRunAt = lastRun.String
	}
	return s, nil
}

// List returns all schedules, newest first.
func (st *Store) List() ([]Schedule, error) {
	rows, err := st.db.Query(`SELECT ` + scheduleColumns + ` FROM schedules ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Schedule
	for rows.Next() {
		s, err := scanSchedule(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// Get returns a single schedule by id. Returns sql.ErrNoRows if absent.
func (st *Store) Get(id string) (Schedule, error) {
	row := st.db.QueryRow(`SELECT `+scheduleColumns+` FROM schedules WHERE id = ?`, id)
	return scanSchedule(row.Scan)
}

// Create inserts a new schedule, stamping created_at/updated_at.
func (st *Store) Create(s Schedule) (Schedule, error) {
	now := st.now().UTC().Format(time.RFC3339)
	s.CreatedAt = now
	s.UpdatedAt = now
	enabled := 0
	if s.Enabled {
		enabled = 1
	}
	_, err := st.db.Exec(`INSERT INTO schedules
		(id, name, instructions, model_provider, model_id, thinking_level,
		 project_path, cron_expr, timezone, enabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.Name, s.Instructions, s.ModelProvider, s.ModelID, s.ThinkingLevel,
		s.ProjectPath, s.CronExpr, s.Timezone, enabled, s.CreatedAt, s.UpdatedAt)
	if err != nil {
		return Schedule{}, err
	}
	return s, nil
}

// Update writes all editable fields and refreshes updated_at.
func (st *Store) Update(s Schedule) (Schedule, error) {
	s.UpdatedAt = st.now().UTC().Format(time.RFC3339)
	enabled := 0
	if s.Enabled {
		enabled = 1
	}
	_, err := st.db.Exec(`UPDATE schedules SET
		name = ?, instructions = ?, model_provider = ?, model_id = ?, thinking_level = ?,
		project_path = ?, cron_expr = ?, timezone = ?, enabled = ?, updated_at = ?
		WHERE id = ?`,
		s.Name, s.Instructions, s.ModelProvider, s.ModelID, s.ThinkingLevel,
		s.ProjectPath, s.CronExpr, s.Timezone, enabled, s.UpdatedAt, s.ID)
	if err != nil {
		return Schedule{}, err
	}
	return st.Get(s.ID)
}

// Delete removes a schedule and its run history.
func (st *Store) Delete(id string) error {
	if _, err := st.db.Exec(`DELETE FROM schedule_runs WHERE schedule_id = ?`, id); err != nil {
		return err
	}
	_, err := st.db.Exec(`DELETE FROM schedules WHERE id = ?`, id)
	return err
}

// SetLastRun records the most recent fire time for a schedule.
func (st *Store) SetLastRun(id string, t time.Time) error {
	_, err := st.db.Exec(`UPDATE schedules SET last_run_at = ? WHERE id = ?`,
		t.UTC().Format(time.RFC3339), id)
	return err
}

// RecordRun inserts a run row and returns its id.
func (st *Store) RecordRun(r Run) (int64, error) {
	res, err := st.db.Exec(`INSERT INTO schedule_runs
		(schedule_id, session_id, session_file, fired_at, status, error)
		VALUES (?, ?, ?, ?, ?, ?)`,
		r.ScheduleID, r.SessionID, r.SessionFile, r.FiredAt, r.Status, r.Error)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// AttachSession links a created session to a run after it is resolved.
func (st *Store) AttachSession(runID int64, sessionID, sessionFile string) error {
	_, err := st.db.Exec(`UPDATE schedule_runs SET session_id = ?, session_file = ? WHERE id = ?`,
		sessionID, sessionFile, runID)
	return err
}

// FailRun marks a run as errored with a message.
func (st *Store) FailRun(runID int64, msg string) error {
	_, err := st.db.Exec(`UPDATE schedule_runs SET status = ?, error = ? WHERE id = ?`,
		RunStatusError, msg, runID)
	return err
}

// ListRuns returns the run history for a schedule, newest first.
func (st *Store) ListRuns(scheduleID string, limit int) ([]Run, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := st.db.Query(`SELECT id, schedule_id, session_id, session_file, fired_at, status, error
		FROM schedule_runs WHERE schedule_id = ? ORDER BY fired_at DESC LIMIT ?`, scheduleID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Run
	for rows.Next() {
		var r Run
		if err := rows.Scan(&r.ID, &r.ScheduleID, &r.SessionID, &r.SessionFile,
			&r.FiredAt, &r.Status, &r.Error); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// ScheduleNameForSession returns the schedule name that created the given
// session, if any. Used to route schedule-specific push notifications and tag
// sessions in the index.
func (st *Store) ScheduleNameForSession(sessionID string) (string, bool) {
	if sessionID == "" {
		return "", false
	}
	var name string
	err := st.db.QueryRow(`SELECT s.name FROM schedules s
		JOIN schedule_runs r ON r.schedule_id = s.id
		WHERE r.session_id = ? LIMIT 1`, sessionID).Scan(&name)
	if err != nil {
		return "", false
	}
	return name, true
}
