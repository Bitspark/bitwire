package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sort"
	"sync"
	"time"
)

// Command is how a testee process starts: its argv, working directory and
// environment beyond the runner's.
type Command struct {
	Argv []string          `json:"argv"`
	Cwd  string            `json:"cwd,omitempty"`
	Env  map[string]string `json:"env,omitempty"`
}

// Hello is what a testee answers hello with (CONTRACT.md §3.5).
type Hello struct {
	Driver   int      `json:"driver"`
	Language string   `json:"language"`
	Layers   []string `json:"layers"`
	Features []string `json:"features"`
}

// Has reports whether hello names the layer or feature.
func (h Hello) Has(need string) bool {
	for _, l := range h.Layers {
		if l == need {
			return true
		}
	}
	for _, f := range h.Features {
		if f == need {
			return true
		}
	}
	return false
}

// without is hello less a feature: the runner's reading of the
// implementation under test when its report declares that it does not
// accept connections (§8.2).
func (h Hello) without(feature string) Hello {
	drop := func(list []string) []string {
		var out []string
		for _, f := range list {
			if f != feature {
				out = append(out, f)
			}
		}
		return out
	}
	out := h
	// Has reads both lists (§3.5), so the feature leaves both.
	out.Layers, out.Features = drop(h.Layers), drop(h.Features)
	return out
}

// Answer is one answer: ok, or an error object.
type Answer struct {
	OK    any
	Error *AnswerError
}

// AnswerError is an error answer: its code, its message when a string, and
// every member for matching (§3.3).
type AnswerError struct {
	Code    string
	Message string
	Members map[string]any
}

func (e *AnswerError) Error() string {
	if e.Message == "" {
		return e.Code
	}
	return e.Code + ": " + e.Message
}

// rendered is an answer's rendering for assert and reports (§7.3).
func (a Answer) rendered() string {
	if a.Error != nil {
		return "error " + render(a.Error.Members)
	}
	return render(a.OK)
}

// Testee is one testee process under the runner's control. It is used by
// one goroutine at a time.
type Testee struct {
	Name   string
	Hello  Hello
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	lines  chan line
	stderr *transcript
	next   int64
	dead   error
	// exited is closed once stdout has ended and the process was reaped;
	// exitCode is then its status, -1 when it was killed.
	exited   chan struct{}
	exitCode int
	stop     chan struct{}
	once     sync.Once
	killTree func()
}

type line struct {
	data []byte
	err  error
}

// Start runs a testee and greets it. A hello whose ok is not driver 1 is
// refused (§3.5).
func Start(name string, c Command, extraEnv map[string]string) (*Testee, error) {
	if len(c.Argv) == 0 {
		return nil, fmt.Errorf("the %s testee has no command", name)
	}
	cmd := exec.Command(c.Argv[0], c.Argv[1:]...)
	cmd.Dir = c.Cwd
	env := os.Environ()
	for _, source := range []map[string]string{c.Env, extraEnv} {
		keys := make([]string, 0, len(source))
		for key := range source {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			env = append(env, key+"="+source[key])
		}
	}
	cmd.Env = env
	// A testee may be a wrapper (a script, go run) whose child holds the
	// streams: the runner ends the whole tree, and never waits unboundedly
	// for a stream a leftover process keeps open.
	cmd.WaitDelay = time.Second
	prepareTree(cmd)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	errs := &transcript{}
	cmd.Stderr = errs
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start the %s testee: %w", name, err)
	}
	t := &Testee{
		Name: name, cmd: cmd, stdin: stdin, lines: make(chan line), stderr: errs,
		exited: make(chan struct{}), stop: make(chan struct{}), killTree: adoptTree(cmd),
	}
	go func() {
		reader := bufio.NewReaderSize(stdout, 1<<20)
		for {
			data, err := reader.ReadBytes('\n')
			if err == nil || len(data) > 0 {
				select {
				case t.lines <- line{data: data, err: err}:
				case <-t.stop:
				}
			}
			if err != nil {
				break
			}
		}
		close(t.lines)
		// Only now may Wait close the pipe: os/exec forbids waiting while
		// stdout is still being read.
		_ = cmd.Wait()
		t.exitCode = cmd.ProcessState.ExitCode()
		close(t.exited)
	}()
	answer, err := t.Request("hello", nil, 10*time.Second)
	if err != nil {
		stderr := errs.String()
		t.Kill()
		return nil, fmt.Errorf("the %s testee did not answer hello: %w\n%s", name, err, stderr)
	}
	hello, reason := readHello(answer)
	if reason != "" {
		t.Kill()
		return nil, fmt.Errorf("the %s testee answered hello with %s: %s", name, answer.rendered(), reason)
	}
	t.Hello = hello
	return t, nil
}

// readHello reads hello's ok by its exact member names (§3.5): driver
// exactly the integer 1; language a string; layers and features arrays of
// strings. An absent or null language, layers or features reads as empty,
// as the upstream runner read it; a member of another type is refused. It
// says why a hello is refused, or "".
func readHello(answer Answer) (Hello, string) {
	if answer.Error != nil {
		return Hello{}, "an error, not a hello"
	}
	object, isObject := answer.OK.(map[string]any)
	if !isObject {
		return Hello{}, "not an object"
	}
	driver, isNumber := object["driver"].(json.Number)
	if !isNumber || driver.String() != "1" {
		return Hello{}, "driver is not the integer 1"
	}
	hello := Hello{Driver: 1}
	switch language := object["language"].(type) {
	case nil:
	case string:
		hello.Language = language
	default:
		return Hello{}, "language is not a string"
	}
	var ok bool
	if hello.Layers, ok = stringList(object["layers"]); !ok {
		return Hello{}, "layers is not an array of strings"
	}
	if hello.Features, ok = stringList(object["features"]); !ok {
		return Hello{}, "features is not an array of strings"
	}
	return hello, ""
}

func stringList(v any) ([]string, bool) {
	if v == nil {
		return nil, true
	}
	list, isList := v.([]any)
	if !isList {
		return nil, false
	}
	out := make([]string, 0, len(list))
	for _, item := range list {
		s, isString := item.(string)
		if !isString {
			return nil, false
		}
		out = append(out, s)
	}
	return out, true
}

// Request sends one op and waits for its answer, within one deadline for
// both writing the request and reading the answer. Any breach of the
// exchange makes the testee dead and ends its process (§3.8).
func (t *Testee) Request(op string, args map[string]any, within time.Duration) (Answer, error) {
	if t.dead != nil {
		return Answer{}, t.dead
	}
	t.next++
	request := map[string]any{}
	for key, value := range args {
		request[key] = value
	}
	request["id"], request["op"] = t.next, op
	data, err := json.Marshal(request)
	if err != nil {
		return Answer{}, fmt.Errorf("the request cannot be written: %w", err)
	}
	timer := time.NewTimer(within)
	defer timer.Stop()
	written := make(chan error, 1)
	go func() {
		_, err := t.stdin.Write(append(data, '\n'))
		written <- err
	}()
	select {
	case err := <-written:
		if err != nil {
			return Answer{}, t.die(fmt.Errorf("the %s testee stopped reading: %w", t.Name, err))
		}
	case <-timer.C:
		return Answer{}, t.die(fmt.Errorf("the %s testee did not read %s within %s", t.Name, op, within))
	}
	var l line
	select {
	case got, open := <-t.lines:
		if !open {
			return Answer{}, t.die(fmt.Errorf("the %s testee's stdout has ended", t.Name))
		}
		l = got
	case <-timer.C:
		return Answer{}, t.die(fmt.Errorf("the %s testee did not answer %s within %s", t.Name, op, within))
	}
	if l.err != nil {
		return Answer{}, t.die(fmt.Errorf("the %s testee's stdout ended inside a line: %q", t.Name, l.data))
	}
	answer, err := readAnswer(l.data, t.next)
	if err != nil {
		return Answer{}, t.die(fmt.Errorf("the %s testee %w", t.Name, err))
	}
	return answer, nil
}

// readAnswer reads one answer line to request id (§3.3): exact member
// names, nothing but JSON whitespace after the object, an error that is an
// object with a nonempty string code, and an absent ok read as {}.
func readAnswer(data []byte, id int64) (Answer, error) {
	trimmed := bytes.TrimSuffix(data, []byte("\n"))
	value, err := decode(trimmed)
	if err != nil {
		return Answer{}, fmt.Errorf("wrote a line that is not an answer: %q", trimmed)
	}
	object, ok := value.(map[string]any)
	if !ok {
		return Answer{}, fmt.Errorf("wrote a line that is not an object: %q", trimmed)
	}
	n, isNumber := object["id"].(json.Number)
	got, err := n.Int64()
	if !isNumber || err != nil || got != id {
		return Answer{}, fmt.Errorf("answered %s to request %d", render(object["id"]), id)
	}
	if raw, present := object["error"]; present {
		members, ok := raw.(map[string]any)
		if !ok {
			return Answer{}, fmt.Errorf("answered an error that is not an object: %s", render(raw))
		}
		code, _ := members["code"].(string)
		if code == "" {
			return Answer{}, fmt.Errorf("answered an error without a code: %s", render(raw))
		}
		message, _ := members["message"].(string)
		return Answer{Error: &AnswerError{Code: code, Message: message, Members: members}}, nil
	}
	result, present := object["ok"]
	if !present {
		return Answer{OK: map[string]any{}}, nil
	}
	return Answer{OK: result}, nil
}

func (t *Testee) die(err error) error {
	t.dead = err
	t.Kill()
	return err
}

// Reset asks the testee to forget everything, and discards its stderr.
func (t *Testee) Reset() error {
	answer, err := t.Request("reset", nil, 10*time.Second)
	if err != nil {
		return err
	}
	if answer.Error != nil {
		return fmt.Errorf("the %s testee did not reset: %v", t.Name, answer.Error)
	}
	t.stderr.truncate()
	return nil
}

// Stop says bye, closes stdin and waits 10 s for the exit, then kills
// (§3.5). It reports whether the testee answered bye and exited with
// status 0 by itself.
func (t *Testee) Stop() bool {
	clean := false
	if t.dead == nil && !t.Exited() {
		if answer, err := t.Request("bye", nil, 10*time.Second); err == nil && answer.Error == nil {
			_ = t.stdin.Close()
			select {
			case <-t.exited:
				clean = t.exitCode == 0
			case <-time.After(10 * time.Second):
			}
		}
	}
	t.Kill()
	return clean
}

// Kill ends the process and every process it started, without ceremony.
func (t *Testee) Kill() {
	t.once.Do(func() {
		close(t.stop)
		_ = t.stdin.Close()
		if !t.Exited() {
			t.killTree()
		}
	})
	select {
	case <-t.exited:
	case <-time.After(10 * time.Second):
	}
	if t.dead == nil {
		t.dead = fmt.Errorf("the %s testee was stopped", t.Name)
	}
}

// Exited reports whether the process has ended.
func (t *Testee) Exited() bool {
	select {
	case <-t.exited:
		return true
	default:
		return false
	}
}

// Dead reports why the testee is no longer usable, or nil. A process that
// ended between requests is dead too (§3.8).
func (t *Testee) Dead() error {
	if t.dead == nil && t.Exited() {
		t.dead = fmt.Errorf("the %s testee exited with status %d", t.Name, t.exitCode)
	}
	return t.dead
}

// Stderr is what the testee wrote on stderr since its last reset.
func (t *Testee) Stderr() string { return t.stderr.String() }

type transcript struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (tr *transcript) Write(p []byte) (int, error) {
	tr.mu.Lock()
	defer tr.mu.Unlock()
	return tr.buf.Write(p)
}

func (tr *transcript) String() string {
	tr.mu.Lock()
	defer tr.mu.Unlock()
	return tr.buf.String()
}

func (tr *transcript) truncate() {
	tr.mu.Lock()
	defer tr.mu.Unlock()
	tr.buf.Reset()
}
