//go:build !windows

package main

import (
	"os/exec"
	"syscall"
)

// prepareTree starts the testee in a process group of its own, so that the
// killer adoptTree returns reaches every process it started.
func prepareTree(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func adoptTree(cmd *exec.Cmd) func() {
	return func() {
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		_ = cmd.Process.Kill()
	}
}
