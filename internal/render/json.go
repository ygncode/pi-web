package render

import (
	"encoding/json"
	"net/http"
)

// WriteJSON writes a JSON payload to ResponseWriter with an optional status.
// Pass status=0 to omit sending a status header (leaves default 200).
// Encode errors are intentionally discarded — by then headers are sent and
// the client is the right party to detect transport failure.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	if status != 0 {
		w.WriteHeader(status)
	}
	_ = json.NewEncoder(w).Encode(payload)
}

// WriteJSONError writes a JSON formatted error response with the given status and message.
func WriteJSONError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]any{"error": message})
}
