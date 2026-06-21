// Package chatqueue is the SQLite-backed store for per-session chat message
// queues. The queue lets a user line up follow-up prompts that the worker
// drains autonomously when it becomes idle, even across browser refreshes
// (and, with the drainer running, across browser closes).
//
// Two tables back the feature:
//
//   - chat_queue_items: append-only list of pending messages, ordered by
//     position within a session.
//   - chat_queue_state: per-session settings (currently just `paused`).
//
// Steers are intentionally not modelled here: they belong to a specific
// in-flight run on the browser and have no meaning after the page goes away.
package chatqueue

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// ItemsTableDDL creates the queue items table. Registered in server.initDB.
const ItemsTableDDL = `CREATE TABLE IF NOT EXISTS chat_queue_items (
	session_id   TEXT NOT NULL,
	position     INTEGER NOT NULL,
	message      TEXT NOT NULL,
	display_text TEXT NOT NULL,
	created_at   DATETIME NOT NULL,
	PRIMARY KEY (session_id, position)
)`

// ItemsSessionIndexDDL speeds up the List + drainer scans.
const ItemsSessionIndexDDL = `CREATE INDEX IF NOT EXISTS chat_queue_items_session_idx
	ON chat_queue_items(session_id, position)`

// StateTableDDL creates the per-session settings table. `next_position` holds
// the next monotonic position for this session: positions are never reused even
// after an item is removed, so any client-side identifier stays stable.
const StateTableDDL = `CREATE TABLE IF NOT EXISTS chat_queue_state (
	session_id    TEXT PRIMARY KEY,
	paused        INTEGER NOT NULL DEFAULT 0,
	next_position INTEGER NOT NULL DEFAULT 1,
	updated_at    DATETIME NOT NULL
)`

// Item is a single queued message in the order the user added it.
type Item struct {
	SessionID   string    `json:"sessionId"`
	Position    int64     `json:"position"`
	Message     string    `json:"message"`
	DisplayText string    `json:"displayText"`
	CreatedAt   time.Time `json:"createdAt"`
}

// Snapshot is the full state returned to the browser: the ordered items plus
// the paused flag.
type Snapshot struct {
	Items  []Item `json:"items"`
	Paused bool   `json:"paused"`
}

// Store is a thin SQLite-backed repository for queues and paused state. The
// schema must already be created (see ItemsTableDDL / StateTableDDL,
// registered in server.initDB).
type Store struct {
	db  *sql.DB
	Now func() time.Time
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db, Now: time.Now}
}

func (s *Store) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// List returns the snapshot for a session: items in queue order plus the
// paused flag. An unknown session yields an empty snapshot (paused=false), not
// an error.
func (s *Store) List(sessionID string) (Snapshot, error) {
	if sessionID == "" {
		return Snapshot{}, errors.New("sessionID is required")
	}
	rows, err := s.db.Query(
		`SELECT position, message, display_text, created_at
		 FROM chat_queue_items WHERE session_id = ? ORDER BY position ASC`,
		sessionID,
	)
	if err != nil {
		return Snapshot{}, fmt.Errorf("query items: %w", err)
	}
	defer rows.Close()
	var items []Item
	for rows.Next() {
		var item Item
		item.SessionID = sessionID
		if err := rows.Scan(&item.Position, &item.Message, &item.DisplayText, &item.CreatedAt); err != nil {
			return Snapshot{}, fmt.Errorf("scan item: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return Snapshot{}, fmt.Errorf("iterate items: %w", err)
	}
	paused, err := s.isPaused(sessionID)
	if err != nil {
		return Snapshot{}, err
	}
	return Snapshot{Items: items, Paused: paused}, nil
}

// IsPaused returns whether autonomous draining is paused for the session.
// Unknown sessions are reported as not paused.
func (s *Store) IsPaused(sessionID string) (bool, error) {
	return s.isPaused(sessionID)
}

func (s *Store) isPaused(sessionID string) (bool, error) {
	var paused int
	err := s.db.QueryRow(
		`SELECT paused FROM chat_queue_state WHERE session_id = ?`, sessionID,
	).Scan(&paused)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("query paused: %w", err)
	}
	return paused != 0, nil
}

// Add appends an item to the session's queue and returns the new row. The
// position is the previous max+1 (or 1 if the queue was empty); positions are
// monotonic per session, never reused.
func (s *Store) Add(sessionID, message, displayText string) (Item, error) {
	if sessionID == "" {
		return Item{}, errors.New("sessionID is required")
	}
	if message == "" {
		return Item{}, errors.New("message is required")
	}
	if displayText == "" {
		displayText = message
	}
	now := s.now().UTC()
	tx, err := s.db.Begin()
	if err != nil {
		return Item{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()
	// Take the next position from chat_queue_state.next_position and bump it,
	// so positions are monotonic per session even across removals — that keeps
	// position usable as a stable identifier on the client.
	if _, err := tx.Exec(
		`INSERT INTO chat_queue_state (session_id, paused, next_position, updated_at)
		 VALUES (?, 0, 1, ?)
		 ON CONFLICT(session_id) DO NOTHING`,
		sessionID, now,
	); err != nil {
		return Item{}, fmt.Errorf("ensure state: %w", err)
	}
	var next int64
	if err := tx.QueryRow(
		`SELECT next_position FROM chat_queue_state WHERE session_id = ?`, sessionID,
	).Scan(&next); err != nil {
		return Item{}, fmt.Errorf("read next position: %w", err)
	}
	if _, err := tx.Exec(
		`UPDATE chat_queue_state SET next_position = next_position + 1, updated_at = ? WHERE session_id = ?`,
		now, sessionID,
	); err != nil {
		return Item{}, fmt.Errorf("bump next position: %w", err)
	}
	if _, err := tx.Exec(
		`INSERT INTO chat_queue_items (session_id, position, message, display_text, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		sessionID, next, message, displayText, now,
	); err != nil {
		return Item{}, fmt.Errorf("insert item: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return Item{}, fmt.Errorf("commit: %w", err)
	}
	return Item{
		SessionID:   sessionID,
		Position:    next,
		Message:     message,
		DisplayText: displayText,
		CreatedAt:   now,
	}, nil
}

// Remove deletes a single item by (sessionID, position). Returns nil if the
// row didn't exist — idempotent so the UI can fire-and-forget without racing.
func (s *Store) Remove(sessionID string, position int64) error {
	if sessionID == "" {
		return errors.New("sessionID is required")
	}
	_, err := s.db.Exec(
		`DELETE FROM chat_queue_items WHERE session_id = ? AND position = ?`,
		sessionID, position,
	)
	if err != nil {
		return fmt.Errorf("delete item: %w", err)
	}
	return nil
}

// PopHead removes and returns the lowest-position item for a session. Returns
// (Item{}, false, nil) if the queue is empty — used by the autonomous drainer
// when the worker is idle.
func (s *Store) PopHead(sessionID string) (Item, bool, error) {
	if sessionID == "" {
		return Item{}, false, errors.New("sessionID is required")
	}
	row := s.db.QueryRow(
		`SELECT position, message, display_text, created_at
		 FROM chat_queue_items WHERE session_id = ? ORDER BY position ASC LIMIT 1`,
		sessionID,
	)
	var item Item
	item.SessionID = sessionID
	if err := row.Scan(&item.Position, &item.Message, &item.DisplayText, &item.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return Item{}, false, nil
		}
		return Item{}, false, fmt.Errorf("query head: %w", err)
	}
	if _, err := s.db.Exec(
		`DELETE FROM chat_queue_items WHERE session_id = ? AND position = ?`,
		sessionID, item.Position,
	); err != nil {
		return Item{}, false, fmt.Errorf("delete head: %w", err)
	}
	return item, true, nil
}

// SetPaused writes the per-session paused flag. paused=false with no items
// effectively clears any saved state, but we keep the row anyway for simplicity.
func (s *Store) SetPaused(sessionID string, paused bool) error {
	if sessionID == "" {
		return errors.New("sessionID is required")
	}
	val := 0
	if paused {
		val = 1
	}
	_, err := s.db.Exec(
		`INSERT INTO chat_queue_state (session_id, paused, next_position, updated_at)
		 VALUES (?, ?, 1, ?)
		 ON CONFLICT(session_id) DO UPDATE SET paused=excluded.paused, updated_at=excluded.updated_at`,
		sessionID, val, s.now().UTC(),
	)
	if err != nil {
		return fmt.Errorf("upsert paused: %w", err)
	}
	return nil
}

// SessionsWithItems lists session ids that have at least one queued item AND
// are not paused — the set the autonomous drainer needs to wake up.
func (s *Store) SessionsWithItems() ([]string, error) {
	rows, err := s.db.Query(
		`SELECT DISTINCT q.session_id
		 FROM chat_queue_items q
		 LEFT JOIN chat_queue_state st ON st.session_id = q.session_id
		 WHERE COALESCE(st.paused, 0) = 0`,
	)
	if err != nil {
		return nil, fmt.Errorf("query sessions: %w", err)
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan session id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// Clear drops everything for a session. Currently unused; intended for
// session-fork / session-delete to keep the table tidy.
func (s *Store) Clear(sessionID string) error {
	if sessionID == "" {
		return errors.New("sessionID is required")
	}
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM chat_queue_items WHERE session_id = ?`, sessionID); err != nil {
		return fmt.Errorf("clear items: %w", err)
	}
	if _, err := tx.Exec(`DELETE FROM chat_queue_state WHERE session_id = ?`, sessionID); err != nil {
		return fmt.Errorf("clear state: %w", err)
	}
	return tx.Commit()
}
