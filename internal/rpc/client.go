package rpc

import (
	"encoding/json"
	"io"

	"pi-web/internal/chat"
)

type response struct {
	ID      string          `json:"id"`
	Type    string          `json:"type"`
	Command string          `json:"command"`
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   string          `json:"error"`
}

type model struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
}

func WriteCommand(w io.Writer, cmd map[string]any) error {
	data, err := json.Marshal(cmd)
	if err != nil {
		return err
	}
	_, err = w.Write(append(data, '\n'))
	return err
}

func buildSwitchSessionCommand(id, sessionPath string) map[string]any {
	return map[string]any{"id": id, "type": "switch_session", "sessionPath": sessionPath}
}

func BuildPromptCommand(id string, chat chat.Request, streaming bool) map[string]any {
	cmd := map[string]any{"id": id, "type": "prompt", "message": chat.Message}
	if len(chat.Images) > 0 {
		cmd["images"] = chat.Images
	}
	if streaming {
		cmd["streamingBehavior"] = "steer"
	}
	return cmd
}

func BuildGetStateCommand(id string) map[string]any {
	return map[string]any{"id": id, "type": "get_state"}
}

func BuildAbortCommand(id string) map[string]any {
	return map[string]any{"id": id, "type": "abort"}
}

func BuildSetThinkingLevelCommand(id, level string) map[string]any {
	return map[string]any{"id": id, "type": "set_thinking_level", "level": level}
}

func BuildGetCommandsCommand(id string) map[string]any {
	return map[string]any{"id": id, "type": "get_commands"}
}
