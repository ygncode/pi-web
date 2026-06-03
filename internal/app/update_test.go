package app

import (
	"context"
	"slices"
	"testing"
)

// The in-app updater must hand install.sh the in-place flag so it skips the
// service stop/restart (which would kill the npm process running it).
func TestInstallCmdSignalsInPlaceUpdate(t *testing.T) {
	cmd := installCmd(context.Background())

	wantArgs := []string{"pi", "install", installPackage}
	if !slices.Equal(cmd.Args, wantArgs) {
		t.Fatalf("args = %v, want %v", cmd.Args, wantArgs)
	}

	want := inPlaceUpdateEnv + "=1"
	if !slices.Contains(cmd.Env, want) {
		t.Errorf("env missing %q; got %v", want, cmd.Env)
	}
}
