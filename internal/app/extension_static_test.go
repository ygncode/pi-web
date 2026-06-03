package app

import (
	"os"
	"strings"
	"testing"
)

func TestPiWebExtensionRegistersExpectedCommands(t *testing.T) {
	data, err := os.ReadFile(repoPath(".pi/extensions/pi-web.ts"))
	if err != nil {
		t.Fatalf("read extension: %v", err)
	}
	src := string(data)
	for _, want := range []string{
		`pi.registerCommand("pi-web"`,
		`pi.registerCommand("remote"`,
		`pi.registerCommand("refresh"`,
		`Usage: /pi-web [status|version|path|token|set-token|start|stop|restart|remote|update|help]`,
		"launchctl",
		"systemctl",
		`import("qrcode")`,
	} {
		if !strings.Contains(src, want) {
			t.Fatalf("extension missing expected marker %q", want)
		}
	}
}
