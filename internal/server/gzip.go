package server

import (
	"compress/gzip"
	"io"
	"net/http"
	"strings"
	"sync"
)

// gzipWriter wraps an http.ResponseWriter, gzipping the body when the client
// sent Accept-Encoding: gzip. Streaming responses (SSE) bypass it: they must
// flush progressively and must not be buffered behind a gzip writer.
type gzipWriter struct {
	http.ResponseWriter
	gz          *gzip.Writer
	passthrough bool
	headerSent  bool
}

// WriteHeader is overridden so responses whose handler sets the status
// explicitly (auth 401 page) still get their headers before the flush.
func (g *gzipWriter) WriteHeader(code int) {
	g.headerSent = true
	ct := g.Header().Get("Content-Type")
	if code < 400 && g.gz == nil && !g.passthrough && compressible(ct) &&
		!strings.HasPrefix(ct, "text/event-stream") {
		g.Header().Set("Content-Encoding", "gzip")
		g.Header().Del("Content-Length")
		g.Header().Add("Vary", "Accept-Encoding")
		g.gz = gzipWriterPool.Get().(*gzip.Writer)
		g.gz.Reset(g.ResponseWriter)
	} else {
		g.passthrough = true
	}
	g.ResponseWriter.WriteHeader(code)
}

func (g *gzipWriter) Write(b []byte) (int, error) {
	if g.headerSent {
		if g.passthrough {
			return g.ResponseWriter.Write(b)
		}
		return g.gz.Write(b)
	}
	if g.gz == nil && !g.passthrough {
		ct := g.Header().Get("Content-Type")
		if compressible(ct) && ct != "text/plain; charset=utf-8" && !strings.HasPrefix(ct, "text/event-stream") {
			g.Header().Set("Content-Encoding", "gzip")
			g.Header().Del("Content-Length")
			g.Header().Add("Vary", "Accept-Encoding")
			g.gz = gzipWriterPool.Get().(*gzip.Writer)
			g.gz.Reset(g.ResponseWriter)
		} else {
			g.passthrough = true
		}
	}
	if g.passthrough {
		return g.ResponseWriter.Write(b)
	}
	return g.gz.Write(b)
}

// compressible reports whether a content type benefits from gzip.
func compressible(ct string) bool {
	ct = strings.ToLower(ct)
	for _, p := range []string{"text/", "application/json", "application/javascript", "application/xml", "image/svg"} {
		if strings.HasPrefix(ct, p) {
			return true
		}
	}
	return false
}

// Flush passes through so handlers that stream after the header is set keep
// working; the gzip buffer is flushed too.
func (g *gzipWriter) Flush() {
	if g.gz != nil {
		_ = g.gz.Flush()
	}
	if f, ok := g.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Close flushes and releases the gzip writer when one was created.
func (g *gzipWriter) Close() {
	if g.gz != nil {
		_ = g.gz.Close()
		gzipWriterPool.Put(g.gz)
		g.gz = nil
	}
}

var gzipWriterPool = sync.Pool{New: func() any { return gzip.NewWriter(io.Discard) }}

// acceptsGzip reports whether the request can receive a gzip-encoded body.
func acceptsGzip(r *http.Request) bool {
	for _, v := range r.Header.Values("Accept-Encoding") {
		if strings.Contains(strings.ToLower(v), "gzip") {
			return true
		}
	}
	return false
}

// gzipHandler wraps h with transparent gzip compression for compressible
// responses. SSE endpoints must be mounted outside of it (streaming).
func gzipHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// /static/ assets are pre-compressed by frontend.ServeJS — compressing
		// again yields gzip-inside-gzip ("Invalid or unexpected token").
		if !acceptsGzip(r) || strings.HasPrefix(r.URL.Path, "/static/") {
			next.ServeHTTP(w, r)
			return
		}
		gw := &gzipWriter{ResponseWriter: w}
		defer gw.Close()
		next.ServeHTTP(gw, r)
	})
}

// GzipMiddleware is the public entry: wraps mux with gzip for compressible
// content types. Streaming endpoints (text/event-stream) and pre-compressed
// assets pass through untouched so progressive flush keeps working.
func GzipMiddleware(next http.Handler) http.Handler {
	return gzipHandler(next)
}
