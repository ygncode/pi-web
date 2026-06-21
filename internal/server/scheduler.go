package server

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"pi-web/internal/chat"
	"pi-web/internal/schedules"
	"pi-web/internal/sessions"
)

// scheduleTickInterval is how often the scheduler re-evaluates due schedules.
// Cron is minute-resolution, so a sub-minute tick keeps firing within a few
// seconds of the target time.
const scheduleTickInterval = 30 * time.Second

// scheduleWorkerTimeout bounds the EnsureWorker step when a schedule fires.
const scheduleWorkerTimeout = 60 * time.Second

// scheduleState tracks, per schedule, the next time it should fire and the
// cron/timezone signature it was computed from (so edits force a recompute).
type scheduleState struct {
	next time.Time
	sig  string
}

func scheduleSig(sc schedules.Schedule) string {
	return sc.CronExpr + "|" + sc.Timezone
}

// runScheduler ticks until stopped, firing any schedule whose next occurrence
// has arrived. Missed occurrences (while the process was down) are skipped:
// a schedule's first evaluation computes its next fire from now, never the past.
func (s *Server) runScheduler(stop <-chan struct{}, interval time.Duration) {
	state := make(map[string]scheduleState)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		s.evaluateSchedules(state)
		select {
		case <-ticker.C:
		case <-stop:
			return
		}
	}
}

func (s *Server) evaluateSchedules(state map[string]scheduleState) {
	if s.schedules == nil {
		return
	}
	list, err := s.schedules.List()
	if err != nil {
		fmt.Fprintf(os.Stderr, "scheduler: list schedules: %v\n", err)
		return
	}
	now := s.now()
	seen := make(map[string]bool, len(list))
	for _, sc := range list {
		seen[sc.ID] = true
		if !sc.Enabled || sc.IsManual() {
			delete(state, sc.ID)
			continue
		}
		sig := scheduleSig(sc)
		st, ok := state[sc.ID]
		if !ok || st.sig != sig {
			next, err := schedules.NextFire(sc.CronExpr, sc.Timezone, now)
			if err != nil {
				fmt.Fprintf(os.Stderr, "scheduler: %q invalid cron %q: %v\n", sc.Name, sc.CronExpr, err)
				delete(state, sc.ID)
				continue
			}
			state[sc.ID] = scheduleState{next: next, sig: sig}
			continue
		}
		if now.Before(st.next) {
			continue
		}
		sc := sc
		go func() {
			if _, err := s.fireSchedule(sc); err != nil {
				fmt.Fprintf(os.Stderr, "scheduler: fire %q: %v\n", sc.Name, err)
			}
		}()
		next, err := schedules.NextFire(sc.CronExpr, sc.Timezone, now)
		if err != nil {
			delete(state, sc.ID)
			continue
		}
		state[sc.ID] = scheduleState{next: next, sig: sig}
	}
	for id := range state {
		if !seen[id] {
			delete(state, id)
		}
	}
}

// scheduleNameForSession reports whether a session was created by a schedule,
// returning the schedule's name. Used to route schedule-specific notifications.
func (s *Server) scheduleNameForSession(sessionID string) (string, bool) {
	if s.schedules == nil {
		return "", false
	}
	return s.schedules.ScheduleNameForSession(sessionID)
}

// fireSchedule creates a fresh pi session for the schedule, records the run, and
// sends the instructions as the first message so pi runs autonomously. Returns
// the created session's UUID. Used by both the timer and the Run-now endpoint.
func (s *Server) fireSchedule(sc schedules.Schedule) (string, error) {
	if s.schedules == nil {
		return "", errors.New("schedules unavailable")
	}
	fired := s.now().UTC()
	runID, err := s.schedules.RecordRun(schedules.Run{
		ScheduleID: sc.ID,
		FiredAt:    fired.Format(time.RFC3339),
		Status:     schedules.RunStatusRunning,
	})
	if err != nil {
		return "", fmt.Errorf("record run: %w", err)
	}
	_ = s.schedules.SetLastRun(sc.ID, fired)

	path := strings.TrimSpace(sc.ProjectPath)
	if path == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			_ = s.schedules.FailRun(runID, err.Error())
			return "", err
		}
		path = home
	}

	settings := sessions.InitialSettings{
		ModelProvider: sc.ModelProvider,
		ModelID:       sc.ModelID,
		ThinkingLevel: sc.ThinkingLevel,
	}
	filename, err := sessions.CreateSessionFileWithSettings(s.sessionsDir, path, settings)
	if err != nil {
		_ = s.schedules.FailRun(runID, err.Error())
		return "", fmt.Errorf("create session: %w", err)
	}
	resolved, err := sessions.ResolveByID(s.sessionsDir, filename)
	if err != nil {
		_ = s.schedules.FailRun(runID, err.Error())
		return "", fmt.Errorf("resolve session: %w", err)
	}
	sessionID := resolved.Session.ID
	if err := s.schedules.AttachSession(runID, sessionID, filename); err != nil {
		fmt.Fprintf(os.Stderr, "scheduler: attach session: %v\n", err)
	}

	if s.chatSender == nil {
		_ = s.schedules.FailRun(runID, "chat unavailable")
		return sessionID, errors.New("chat unavailable")
	}
	workerCtx, cancel := context.WithTimeout(context.Background(), scheduleWorkerTimeout)
	defer cancel()
	if err := s.chatSender.EnsureWorker(workerCtx, sessionID, resolved.Path); err != nil {
		_ = s.schedules.FailRun(runID, err.Error())
		return sessionID, fmt.Errorf("ensure worker: %w", err)
	}
	if err := s.chatSender.Send(context.Background(), sessionID, resolved.Path, chat.Request{Message: sc.Instructions}); err != nil {
		_ = s.schedules.FailRun(runID, err.Error())
		return sessionID, fmt.Errorf("send: %w", err)
	}
	return sessionID, nil
}
