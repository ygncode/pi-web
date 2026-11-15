package render

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
)

// WriteJSONConditional writes payload as JSON with a strong ETag over the
// exact encoded bytes. A request whose If-None-Match matches returns 304 with
// no body, so repeat fetches of an unchanged payload cost a header round trip
// instead of the full transfer. Responses carry Cache-Control: private,
// must-revalidate — the browser may store them (auth-scoped data must not sit
// in shared caches) and must revalidate before every reuse, so a stale copy
// is never shown. Returns true when it wrote a bare 304.
func WriteJSONConditional(w http.ResponseWriter, r *http.Request, payload any) bool {
	body, err := json.Marshal(payload)
	if err != nil {
		WriteJSONError(w, http.StatusInternalServerError, err.Error())
		return false
	}
	etag := ETagOf(body)
	w.Header().Set("ETag", etag)
	w.Header().Set("Cache-Control", "private, must-revalidate")
	if MatchesETag(r.Header.Get("If-None-Match"), etag) {
		w.WriteHeader(http.StatusNotModified)
		return true
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
	return false
}

// ETagOf returns a strong ETag (quoted) for the exact content bytes.
func ETagOf(body []byte) string {
	sum := sha256.Sum256(body)
	return `"` + hex.EncodeToString(sum[:16]) + `"`
}

// MatchesETag reports whether an If-None-Match header matches etag,
// tolerating weak (W/) candidates and comma-separated lists per RFC 7232.
func MatchesETag(header, etag string) bool {
	header = strings.TrimSpace(header)
	if header == "" {
		return false
	}
	if header == "*" {
		return true
	}
	bare := strings.Trim(etag, `"`)
	for _, part := range strings.Split(header, ",") {
		cand := strings.TrimPrefix(strings.TrimSpace(part), "W/")
		cand = strings.Trim(cand, `"`)
		if cand != "" && cand == bare {
			return true
		}
	}
	return false
}
