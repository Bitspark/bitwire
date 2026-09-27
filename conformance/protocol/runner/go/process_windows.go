//go:build windows

package main

import (
	"os/exec"
	"unsafe"

	"golang.org/x/sys/windows"
)

func prepareTree(cmd *exec.Cmd) {}

// adoptTree puts the started testee in a job object, so that every process
// it starts belongs to the job and ending the job ends them all at once. A
// process the testee starts before the job adopts it escapes; a testee's
// wrapper starts its child only after it has itself begun, which is later.
func adoptTree(cmd *exec.Cmd) func() {
	direct := func() { _ = cmd.Process.Kill() }
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return direct
	}
	limit := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	limit.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
	if _, err := windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&limit)), uint32(unsafe.Sizeof(limit))); err != nil {
		_ = windows.CloseHandle(job)
		return direct
	}
	process, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(cmd.Process.Pid))
	if err != nil {
		_ = windows.CloseHandle(job)
		return direct
	}
	defer windows.CloseHandle(process)
	if err := windows.AssignProcessToJobObject(job, process); err != nil {
		_ = windows.CloseHandle(job)
		return direct
	}
	return func() {
		_ = windows.TerminateJobObject(job, 1)
		_ = windows.CloseHandle(job)
		direct()
	}
}
