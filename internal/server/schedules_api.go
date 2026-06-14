package server

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"pi-web/internal/schedules"
)

// scheduleInput is the editable payload for create/update. Server-managed fields
// (id, timestamps, lastRun) are ignored on the way in.
type scheduleInput struct {
	Name          string `json:"name"`
	Instructions  string `json:"instructions"`
	ModelProvider string `json:"modelProvider"`
	ModelID       string `json:"modelId"`
	ThinkingLevel string `json:"thinkingLevel"`
	ProjectPath   string `json:"projectPath"`
	CronExpr      string `json:"cronExpr"`
	Timezone      string `json:"timezone"`
	Enabled       *bool  `json:"enabled"`
}

func (in scheduleInput) validate() (string, bool) {
	if strings.TrimSpace(in.Name) == "" {
		return "name is required", false
	}
	if strings.TrimSpace(in.Instructions) == "" {
		return "instructions are required", false
	}
	if (in.ModelProvider == "") != (in.ModelID == "") {
		return "model provider and id must be set together", false
	}
	if err := schedules.ValidateCron(in.CronExpr); err != nil {
		return "invalid cron expression: " + err.Error(), false
	}
	if _, err := schedules.LoadLocation(in.Timezone); err != nil {
		return "invalid timezone: " + err.Error(), false
	}
	return "", true
}

func (in scheduleInput) apply(sc *schedules.Schedule) {
	sc.Name = strings.TrimSpace(in.Name)
	sc.Instructions = in.Instructions
	sc.ModelProvider = in.ModelProvider
	sc.ModelID = in.ModelID
	sc.ThinkingLevel = in.ThinkingLevel
	sc.ProjectPath = strings.TrimSpace(in.ProjectPath)
	sc.CronExpr = strings.TrimSpace(in.CronExpr)
	sc.Timezone = strings.TrimSpace(in.Timezone)
	if in.Enabled != nil {
		sc.Enabled = *in.Enabled
	}
}

// withNextRun annotates a schedule with its next computed fire time (not stored).
func (s *Server) withNextRun(sc schedules.Schedule) schedules.Schedule {
	if !sc.Enabled || sc.IsManual() {
		return sc
	}
	if next, err := schedules.NextFire(sc.CronExpr, sc.Timezone, s.now()); err == nil {
		sc.NextRunAt = next.UTC().Format(time.RFC3339)
	}
	return sc
}

// handleApiSchedules is the collection endpoint: GET lists, POST creates.
func (s *Server) handleApiSchedules(w http.ResponseWriter, r *http.Request) {
	if s.schedules == nil {
		writeJSONError(w, http.StatusInternalServerError, "schedules unavailable")
		return
	}
	switch r.Method {
	case http.MethodGet:
		list, err := s.schedules.List()
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]schedules.Schedule, 0, len(list))
		for _, sc := range list {
			out = append(out, s.withNextRun(sc))
		}
		writeJSON(w, 0, map[string]any{"schedules": out})
	case http.MethodPost:
		var in scheduleInput
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid json body")
			return
		}
		if msg, ok := in.validate(); !ok {
			writeJSONError(w, http.StatusBadRequest, msg)
			return
		}
		sc := schedules.Schedule{ID: uuid.NewString(), Enabled: true}
		in.apply(&sc)
		created, err := s.schedules.Create(sc)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"schedule": s.withNextRun(created)})
	default:
		w.Header().Set("Allow", "GET, POST")
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// handleApiSchedule is the item endpoint (?id=): GET reads, POST/PUT updates,
// DELETE removes.
func (s *Server) handleApiSchedule(w http.ResponseWriter, r *http.Request) {
	if s.schedules == nil {
		writeJSONError(w, http.StatusInternalServerError, "schedules unavailable")
		return
	}
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		writeJSONError(w, http.StatusBadRequest, "id is required")
		return
	}
	existing, err := s.schedules.Get(id)
	if err == sql.ErrNoRows {
		writeJSONError(w, http.StatusNotFound, "schedule not found")
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	switch r.Method {
	case http.MethodGet:
		writeJSON(w, 0, map[string]any{"schedule": s.withNextRun(existing)})
	case http.MethodPost, http.MethodPut:
		var in scheduleInput
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid json body")
			return
		}
		if msg, ok := in.validate(); !ok {
			writeJSONError(w, http.StatusBadRequest, msg)
			return
		}
		in.apply(&existing)
		updated, err := s.schedules.Update(existing)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, 0, map[string]any{"schedule": s.withNextRun(updated)})
	case http.MethodDelete:
		if err := s.schedules.Delete(id); err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, 0, map[string]any{"ok": true})
	default:
		w.Header().Set("Allow", "GET, POST, PUT, DELETE")
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// handleApiScheduleRun fires a schedule immediately (Run-now), independent of
// its cadence. Works for manual schedules too.
func (s *Server) handleApiScheduleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if s.schedules == nil {
		writeJSONError(w, http.StatusInternalServerError, "schedules unavailable")
		return
	}
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		writeJSONError(w, http.StatusBadRequest, "id is required")
		return
	}
	sc, err := s.schedules.Get(id)
	if err == sql.ErrNoRows {
		writeJSONError(w, http.StatusNotFound, "schedule not found")
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sessionID, err := s.fireSchedule(sc)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "sessionId": sessionID})
}

// handleApiScheduleRuns returns the run history for a schedule (?id=).
func (s *Server) handleApiScheduleRuns(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if s.schedules == nil {
		writeJSONError(w, http.StatusInternalServerError, "schedules unavailable")
		return
	}
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		writeJSONError(w, http.StatusBadRequest, "id is required")
		return
	}
	runs, err := s.schedules.ListRuns(id, 50)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, 0, map[string]any{"runs": runs})
}
