package ui

// appScriptPath is the URL path at which the SPA's Vite module is served. It
// defaults to a stable path and is overwritten at startup when the hashed asset
// is found in the Vite manifest.
var appScriptPath = "/static/assets/app.js"

func SetAppScriptPath(path string) { appScriptPath = path }
