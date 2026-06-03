package server

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// titleWordLimit caps how many words a generated/heuristic title may contain.
const titleWordLimit = 5

// titleStopWords are dropped from heuristic titles. Ported from the former
// pi-web pi extension so behavior is preserved now that titling is built in.
var titleStopWords = map[string]bool{
	"a": true, "an": true, "and": true, "are": true, "can": true, "could": true,
	"do": true, "does": true, "for": true, "from": true, "how": true, "i": true,
	"in": true, "inspired": true, "is": true, "it": true, "like": true, "me": true,
	"need": true, "of": true, "on": true, "or": true, "please": true, "the": true,
	"this": true, "to": true, "us": true, "we": true, "what": true, "when": true,
	"whenever": true, "would": true, "you": true,
}

var titleAcronyms = map[string]string{
	"pi": "Pi", "pi-web": "Pi-Web", "api": "API", "ui": "UI",
	"ux": "UX", "sse": "SSE", "rpc": "RPC", "tui": "TUI",
}

var (
	reFencedCode = regexp.MustCompile("(?s)```.*?```")
	reInlineCode = regexp.MustCompile("`([^`]*)`")
	reURL        = regexp.MustCompile(`https?://\S+`)
	reUnderSlash = regexp.MustCompile(`[_/]+`)
	// Keep letters, numbers, and combining marks (\p{M}) so complex scripts
	// (e.g. Burmese vowel signs/medials) are not split apart.
	reNonWord = regexp.MustCompile(`[^\p{L}\p{N}\p{M}-]+`)
)

func titleCaseWord(word string) string {
	lower := strings.ToLower(word)
	if v, ok := titleAcronyms[lower]; ok {
		return v
	}
	parts := strings.Split(lower, "-")
	for i, p := range parts {
		parts[i] = upperFirstRune(p)
	}
	return strings.Join(parts, "-")
}

// upperFirstRune title-cases the first rune of s without splitting multi-byte
// UTF-8 sequences. For caseless scripts (e.g. Burmese) the rune is returned
// unchanged, leaving the text intact.
func upperFirstRune(s string) string {
	if s == "" {
		return s
	}
	r, size := utf8.DecodeRuneInString(s)
	if r == utf8.RuneError {
		return s
	}
	return string(unicode.ToUpper(r)) + s[size:]
}

// deriveTitleFromInput builds a concise Title Case title from raw user text
// using a stop-word heuristic. Returns "" when no usable title can be formed.
func deriveTitleFromInput(text string) string {
	normalized := reFencedCode.ReplaceAllString(text, " ")
	normalized = reInlineCode.ReplaceAllString(normalized, " $1 ")
	normalized = reURL.ReplaceAllString(normalized, " ")
	normalized = reUnderSlash.ReplaceAllString(normalized, " ")
	normalized = reNonWord.ReplaceAllString(normalized, " ")
	normalized = strings.TrimSpace(normalized)
	if normalized == "" {
		return ""
	}

	words := strings.Fields(normalized)
	meaningful := make([]string, 0, len(words))
	for _, w := range words {
		if !titleStopWords[strings.ToLower(w)] {
			meaningful = append(meaningful, w)
		}
	}
	selected := meaningful
	if len(selected) == 0 {
		selected = words
	}
	if len(selected) > titleWordLimit {
		selected = selected[:titleWordLimit]
	}
	if len(selected) == 0 {
		return ""
	}
	out := make([]string, len(selected))
	for i, w := range selected {
		out[i] = titleCaseWord(w)
	}
	return strings.Join(out, " ")
}
