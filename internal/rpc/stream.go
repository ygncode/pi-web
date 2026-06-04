package rpc

type StreamPreview struct {
	Content string `json:"content"`
	Done    bool   `json:"done"`
}

type StreamEventSink func(StreamPreview)

// WidgetEvent is forwarded to a WidgetSink whenever the pi worker emits a
// setWidget extension_ui_request. Lines=nil indicates removal.
type WidgetEvent struct {
	Key       string
	Lines     []string
	Placement string
	Removed   bool
}

type WidgetSink func(WidgetEvent)

type assistantMessageEvent struct {
	Type    string `json:"type"`
	Delta   string `json:"delta"`
	Content string `json:"content"`
}

type streamPreviewAccumulator struct {
	content string
	active  bool
}

func (a *streamPreviewAccumulator) handleAssistantEvent(event assistantMessageEvent) (StreamPreview, bool) {
	switch event.Type {
	case "text_delta":
		a.content += event.Delta
		a.active = true
		return StreamPreview{Content: a.content}, true
	case "text_end":
		if event.Content != "" {
			a.content = event.Content
		}
		if a.content == "" && !a.active {
			return StreamPreview{}, false
		}
		a.active = false
		preview := StreamPreview{Content: a.content, Done: true}
		a.content = ""
		return preview, true
	default:
		return StreamPreview{}, false
	}
}

func (a *streamPreviewAccumulator) complete() (StreamPreview, bool) {
	if a.content == "" && !a.active {
		return StreamPreview{}, false
	}
	preview := StreamPreview{Content: a.content, Done: true}
	a.content = ""
	a.active = false
	return preview, true
}
