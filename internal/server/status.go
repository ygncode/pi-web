package server

import (
	"encoding/json"

	"pi-web/internal/workers"
)

// computeRunningStatus is the single source of truth for "is this session
// running right now". Both the HTTP handler (handleWorkerStatus) and the SSE
// broadcaster (recomputeAndBroadcastStatus) call this; that is what keeps
// terminal sessions, chat workers, and the recent-activity fallback from
// drifting apart.
//
// Order matches the historical behaviour of handleWorkerStatus:
//  1. session-status/<id> file (terminal sessions)
//  2. in-process chat worker status
//  3. recent jsonl mtime within recentSessionActivityWindow
func (s *Server) computeRunningStatus(sessionID string) bool {
	if sessionID == "" {
		return false
	}
	if status := s.readSessionStatus(sessionID); status != nil && status.State == workers.WorkerStateRunning {
		return true
	}
	if s.chatSender != nil {
		workerStatus := s.chatSender.Status(sessionID)
		if workerStatus.State == workers.WorkerStateRunning {
			return true
		}
		// Authoritative: if we have an in-process chat worker for this
		// session (Model set ⇒ EnsureWorker has resolved it) and it
		// reports idle, trust it and skip the activity-window fallback.
		// Without this short-circuit the JSONL write that records the
		// assistant's final message keeps the session "running" for up
		// to recentSessionActivityWindow, making the Cancel button
		// linger after the response is clearly done.
		if workerStatus.Model != "" {
			return false
		}
	}
	return s.hasRecentSessionActivity(sessionID)
}

func (s *Server) runningStatusPayload(sessionID string, running bool) map[string]any {
	payload := map[string]any{"id": sessionID, "running": running}
	if !running || s.chatSender == nil {
		return payload
	}
	status := s.chatSender.Status(sessionID)
	if status.Model != "" {
		payload["model"] = status.Model
	}
	if status.ModelName != "" {
		payload["modelName"] = status.ModelName
	}
	if status.ModelProvider != "" {
		payload["modelProvider"] = status.ModelProvider
	}
	return payload
}

// recomputeAndBroadcastStatus recomputes the running state for sessionID and,
// if it changed since the last broadcast, sends a status-delta SSE event to
// every __all__ subscriber.
//
// `lastKnown` is the set of session ids currently broadcast as running.
// Absence == idle. We only emit when (now == running) != (id ∈ lastKnown).
// First-touch idle is therefore silent (no spurious running:false flood when
// the sweeper rescans).
func (s *Server) recomputeAndBroadcastStatus(sessionID string) {
	if sessionID == "" {
		return
	}
	now := s.computeRunningStatus(sessionID)

	s.lastKnownMu.Lock()
	_, was := s.lastKnown[sessionID]
	if now == was {
		s.lastKnownMu.Unlock()
		return
	}
	if now {
		s.lastKnown[sessionID] = struct{}{}
	} else {
		delete(s.lastKnown, sessionID)
	}
	s.lastKnownMu.Unlock()

	data, _ := json.Marshal(s.runningStatusPayload(sessionID, now))
	s.broadcast(globalSessID, "event: status-delta\ndata: "+string(data))

	// Transition running → idle: fire a push notification so subscribed
	// clients learn the response is ready even when the tab is closed
	// or the device is locked. Scheduled runs get a schedule-specific push
	// (shown even in the foreground) instead of the generic one.
	if was && !now && s.push != nil {
		if name, ok := s.scheduleNameForSession(sessionID); ok {
			go s.push.NotifyScheduleDone(name, sessionID)
		} else {
			go s.push.NotifyDone(sessionID)
		}
	}
}
