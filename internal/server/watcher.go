package server

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// watchFiles dispatches to fsnotify when available, falling back to polling.
// fsnotify gives ~ms-latency reloads; the poller is the safety net for
// platforms / filesystems where inotify or kqueue isn't available
// (e.g. some NFS mounts).
func (s *Server) watchFiles() {
	if err := s.watchFilesFsnotify(); err != nil {
		fmt.Fprintf(os.Stderr, "fsnotify unavailable, falling back to polling: %v\n", err)
		s.wg.Add(1)
		go func() {
			defer s.wg.Done()
			s.watchFilesPolling()
		}()
	}
}

func (s *Server) watchFilesPolling() {
	ticker := time.NewTicker(1500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.scanForChanges()
		case <-s.stopCh:
			return
		}
	}
}

func (s *Server) scanForChanges() {
	entries, err := os.ReadDir(s.sessionsDir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		subDir := filepath.Join(s.sessionsDir, e.Name())
		subs, err := os.ReadDir(subDir)
		if err != nil {
			continue
		}
		for _, f := range subs {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".jsonl") {
				continue
			}
			path := filepath.Join(subDir, f.Name())
			info, err := os.Stat(path)
			if err != nil {
				continue
			}
			s.recordModTime(f.Name(), info.ModTime())
		}
	}
}

// recordModTime updates the last-known modtime for a session file and
// broadcasts a reload if it advanced. Shared between the polling and
// fsnotify paths so file-mod accounting stays consistent.
func (s *Server) recordModTime(sessID string, mod time.Time) {
	s.fileModMu.Lock()
	lastMod, known := s.fileMod[sessID]
	s.fileMod[sessID] = mod
	s.fileModMu.Unlock()
	if known && mod.After(lastMod) {
		s.broadcast(sessID, "reload")
		s.broadcast(globalSessID, "reload")
		// A content change may be the first user message (or a new turn) that
		// should get an auto-generated title. Run off this hot path; the call
		// cheaply bails when titling is disabled or already handled.
		go s.maybeAutoTitle(sessID)
	}
	// Always recompute status for this session — the running state depends
	// on the live mtime regardless of whether reload was emitted (e.g. the
	// first observation of a brand-new session file).
	s.recomputeAndBroadcastStatus(sessID)
}

// watchFilesFsnotify uses kqueue/inotify to react to writes. Project subdirs
// are watched individually (kqueue isn't recursive) and new ones are added
// dynamically when they appear under sessionsDir.
//
// To avoid sending two reloads for one logical write (editors emit multiple
// Write events), reloads are debounced per file with a short timer.
func (s *Server) watchFilesFsnotify() error {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	if err := w.Add(s.sessionsDir); err != nil {
		_ = w.Close()
		return err
	}

	if entries, err := os.ReadDir(s.sessionsDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				_ = w.Add(filepath.Join(s.sessionsDir, e.Name()))
			}
		}
	}

	s.scanForChanges()

	debouncers := newDebouncer(50 * time.Millisecond)
	debDone := make(chan struct{})
	go func() {
		debouncers.run(s)
		close(debDone)
	}()

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer w.Close()
		defer func() {
			debouncers.stop()
			<-debDone
		}()
		for {
			select {
			case ev, ok := <-w.Events:
				if !ok {
					return
				}
				s.handleFsEvent(w, ev, debouncers)
			case err, ok := <-w.Errors:
				if !ok {
					return
				}
				fmt.Fprintf(os.Stderr, "fsnotify error: %v\n", err)
			case <-s.stopCh:
				return
			}
		}
	}()
	return nil
}

func (s *Server) handleFsEvent(w *fsnotify.Watcher, ev fsnotify.Event, deb *debouncer) {
	if ev.Op&fsnotify.Create != 0 {
		if info, err := os.Stat(ev.Name); err == nil && info.IsDir() {
			_ = w.Add(ev.Name)
			return
		}
	}
	if !strings.HasSuffix(ev.Name, ".jsonl") {
		return
	}
	if ev.Op&(fsnotify.Write|fsnotify.Create) == 0 {
		return
	}
	if ev.Op&fsnotify.Create != 0 {
		s.broadcast(globalSessID, "new-session")
		// Mark newly-created session files as known before the debounced stat.
		// Otherwise a user can open a just-created empty session, send the first
		// chat before the create event is recorded, and the first write is treated
		// as an initial observation instead of a change, so the session page never
		// reloads with the new messages.
		s.fileModMu.Lock()
		if _, known := s.fileMod[filepath.Base(ev.Name)]; !known {
			s.fileMod[filepath.Base(ev.Name)] = time.Time{}
		}
		s.fileModMu.Unlock()
	}
	deb.schedule(ev.Name)
}

type debouncer struct {
	delay  time.Duration
	mu     sync.Mutex
	timers map[string]*time.Timer
	stopCh chan struct{}
	wakeCh chan string
}

func newDebouncer(delay time.Duration) *debouncer {
	return &debouncer{
		delay:  delay,
		timers: make(map[string]*time.Timer),
		stopCh: make(chan struct{}),
		wakeCh: make(chan string, 16),
	}
}

func (d *debouncer) schedule(path string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if t, ok := d.timers[path]; ok {
		if t.Reset(d.delay) {
			// Timer was still pending; successfully rescheduled.
			return
		}
		// Timer already fired but hasn't been removed from the map yet
		// (the callback hasn't acquired d.mu yet). Remove it and fall
		// through to create a fresh timer so we don't double-fire.
		delete(d.timers, path)
	}
	d.timers[path] = time.AfterFunc(d.delay, func() {
		d.mu.Lock()
		delete(d.timers, path)
		d.mu.Unlock()
		select {
		case d.wakeCh <- path:
		case <-d.stopCh:
		}
	})
}

func (d *debouncer) run(s *Server) {
	for {
		select {
		case path := <-d.wakeCh:
			info, err := os.Stat(path)
			if err != nil {
				continue
			}
			s.recordModTime(filepath.Base(path), info.ModTime())
		case <-d.stopCh:
			return
		}
	}
}

func (d *debouncer) stop() {
	close(d.stopCh)
	d.mu.Lock()
	for _, t := range d.timers {
		t.Stop()
	}
	d.timers = nil
	d.mu.Unlock()
}
