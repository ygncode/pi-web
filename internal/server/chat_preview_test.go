package server

import (
	"strings"
	"testing"

	"pi-web/internal/rpc"
)

func TestBroadcastChatPreviewSendsNamedSSEToSession(t *testing.T) {
	s := New(Deps{AgentDir: t.TempDir()})
	defer s.Shutdown()
	client := s.addClient("a.jsonl")
	defer s.removeClient(client)

	s.BroadcastChatPreview("a.jsonl", rpc.StreamPreview{Content: "hello\nworld", Done: false})

	select {
	case msg := <-client.ch:
		if !strings.HasPrefix(msg, "event: chat-preview\ndata: ") {
			t.Fatalf("msg = %q", msg)
		}
		if !strings.Contains(msg, `"content":"hello\nworld"`) {
			t.Fatalf("content was not JSON escaped in msg = %q", msg)
		}
	default:
		t.Fatalf("expected chat-preview broadcast")
	}
}

func TestBroadcastChatPreviewDoesNotSendToGlobalTopic(t *testing.T) {
	s := New(Deps{AgentDir: t.TempDir()})
	defer s.Shutdown()
	client := s.addClient(globalSessID)
	defer s.removeClient(client)

	s.BroadcastChatPreview("a.jsonl", rpc.StreamPreview{Content: "secret", Done: false})

	select {
	case msg := <-client.ch:
		t.Fatalf("global client received chat preview: %q", msg)
	default:
	}
}
