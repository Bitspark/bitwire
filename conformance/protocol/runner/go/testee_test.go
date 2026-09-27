package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

// The fake testee is this test binary run again with RUNNER_FAKE_TESTEE
// naming a script: for each op, the answer lines to write in turn (the last
// repeats), with ID standing for the request's id. HANG writes nothing,
// EXIT ends the process, THEN_EXIT:line answers and then exits, <FF> writes the byte 0xFF, and STDERR:text writes text to stderr and then
// answers {}. Every request received is appended to RUNNER_FAKE_LOG.
func TestMain(m *testing.M) {
	if script := os.Getenv("RUNNER_FAKE_TESTEE"); script != "" {
		fakeTestee(script, os.Getenv("RUNNER_FAKE_LOG"))
		os.Exit(0)
	}
	os.Exit(m.Run())
}

const fakeHello = `{"id":ID,"ok":{"driver":1,"language":"fake","layers":["seam","peer","tunnel"],"features":["listen","lazy","pipe"]}}`

func fakeTestee(scriptFile, logFile string) {
	data, err := os.ReadFile(scriptFile)
	if err != nil {
		panic(err)
	}
	script := map[string][]string{}
	if err := json.Unmarshal(data, &script); err != nil {
		panic(err)
	}
	defaults := map[string][]string{"hello": {fakeHello}, "reset": {`{"id":ID,"ok":{}}`}, "bye": {`{"id":ID,"ok":{}}`}}
	used := map[string]int{}
	var log *os.File
	if logFile != "" {
		if log, err = os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err != nil {
			panic(err)
		}
	}
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 1<<20), 1<<20)
	out := bufio.NewWriter(os.Stdout)
	for scanner.Scan() {
		var request map[string]any
		if err := json.Unmarshal(scanner.Bytes(), &request); err != nil {
			panic(err)
		}
		if log != nil {
			fmt.Fprintln(log, scanner.Text())
		}
		op, _ := request["op"].(string)
		answers, ok := script[op]
		if !ok {
			answers, ok = defaults[op]
		}
		if !ok {
			answers = []string{`{"id":ID,"error":{"code":"unsupported","message":"not scripted"}}`}
		}
		n := used[op]
		used[op]++
		if n >= len(answers) {
			n = len(answers) - 1
		}
		answer := answers[n]
		id := fmt.Sprint(request["id"])
		switch {
		case answer == "HANG":
			continue
		case answer == "EXIT":
			os.Exit(3)
		case strings.HasPrefix(answer, "THEN_EXIT:"):
			fmt.Fprintln(out, strings.ReplaceAll(strings.TrimPrefix(answer, "THEN_EXIT:"), "ID", id))
			out.Flush()
			os.Exit(0)
		case strings.HasPrefix(answer, "STDERR:"):
			fmt.Fprint(os.Stderr, strings.TrimPrefix(answer, "STDERR:"))
			answer = `{"id":ID,"ok":{}}`
		}
		answer = strings.ReplaceAll(strings.ReplaceAll(answer, "ID", id), "<FF>", string([]byte{0xff}))
		fmt.Fprintln(out, answer)
		out.Flush()
		if op == "bye" {
			os.Exit(0)
		}
	}
}

// fake starts the fake testee with a script, and returns it with the file
// its requests are logged to.
func fake(t *testing.T, script map[string][]string) (*Testee, string, error) {
	t.Helper()
	dir := t.TempDir()
	scriptFile, logFile := filepath.Join(dir, "script.json"), filepath.Join(dir, "requests.log")
	data, _ := json.Marshal(script)
	if err := os.WriteFile(scriptFile, data, 0o644); err != nil {
		t.Fatal(err)
	}
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	testee, err := Start("fake", fakeCommand(self), map[string]string{"RUNNER_FAKE_TESTEE": scriptFile, "RUNNER_FAKE_LOG": logFile})
	if testee != nil {
		t.Cleanup(testee.Kill)
	}
	return testee, logFile, err
}

func fakeCommand(self string) Command {
	return Command{Argv: []string{self, "-test.run=^$"}}
}

func requests(t *testing.T, logFile string) []map[string]any {
	t.Helper()
	data, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatal(err)
	}
	var out []map[string]any
	for _, l := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		if l == "" {
			continue
		}
		v, err := decode([]byte(l))
		if err != nil {
			t.Fatal(err)
		}
		out = append(out, v.(map[string]any))
	}
	return out
}

// §3.5: hello must decode to driver exactly the integer 1.
func TestHelloRefusals(t *testing.T) {
	for name, hello := range map[string]string{
		"driver 2":          `{"id":ID,"ok":{"driver":2,"language":"x","layers":[],"features":[]}}`,
		"driver 1.0":        `{"id":ID,"ok":{"driver":1.0,"language":"x","layers":[],"features":[]}}`,
		"driver as string":  `{"id":ID,"ok":{"driver":"1","language":"x","layers":[],"features":[]}}`,
		"capitalized":       `{"id":ID,"ok":{"Driver":1,"language":"x","layers":[],"features":[]}}`,
		"language a number": `{"id":ID,"ok":{"driver":1,"language":1,"layers":[],"features":[]}}`,
		"layers not a list": `{"id":ID,"ok":{"driver":1,"language":"x","layers":"seam","features":[]}}`,
		"an error":          `{"id":ID,"error":{"code":"nope"}}`,
		"exits":             `EXIT`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, _, err := fake(t, map[string][]string{"hello": {hello}}); err == nil {
				t.Fatalf("hello %s was accepted", hello)
			}
		})
	}
	testee, _, err := fake(t, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !testee.Hello.Has("seam") || !testee.Hello.Has("listen") || testee.Hello.Has("observer") {
		t.Errorf("hello: %+v", testee.Hello)
	}
}

// §3.3 and §3.8: what reads as an answer, and what makes a testee dead.
func TestAnswers(t *testing.T) {
	cases := []struct {
		name, line string
		dead       bool
		ok         string
		code       string
	}{
		{"ok", `{"id":ID,"ok":{"handle":"h1"}}`, false, `{"handle":"h1"}`, ""},
		{"ok absent reads as {}", `{"id":ID}`, false, `{}`, ""},
		{"ok null reads as null", `{"id":ID,"ok":null}`, false, `null`, ""},
		{"error wins over ok", `{"id":ID,"ok":1,"error":{"code":"closed","close_code":1000}}`, false, "", "closed"},
		{"numbers keep their spelling", `{"id":ID,"ok":{"n":1e3}}`, false, `{"n":1e3}`, ""},
		{"trailing space", `{"id":ID,"ok":{}}  `, false, `{}`, ""},
		{"invalid UTF-8 becomes U+FFFD", `{"id":ID,"ok":"a<FF>b"}`, false, "\"a�b\"", ""},
		{"wrong id", `{"id":999,"ok":{}}`, true, "", ""},
		{"id as string", `{"id":"ID","ok":{}}`, true, "", ""},
		{"not JSON", `hello`, true, "", ""},
		{"not an object", `[1]`, true, "", ""},
		{"trailing data", `{"id":ID,"ok":{}} x`, true, "", ""},
		{"error not an object", `{"id":ID,"error":"closed"}`, true, "", ""},
		{"error without code", `{"id":ID,"error":{"message":"m"}}`, true, "", ""},
		{"error with empty code", `{"id":ID,"error":{"code":""}}`, true, "", ""},
		{"capitalized members", `{"ID":ID,"OK":{}}`, true, "", ""},
		{"stdout ends", `EXIT`, true, "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			testee, _, err := fake(t, map[string][]string{"conn.send": {c.line}})
			if err != nil {
				t.Fatal(err)
			}
			answer, err := testee.Request("conn.send", map[string]any{"on": "c"}, 5*time.Second)
			if c.dead {
				if err == nil || testee.Dead() == nil {
					t.Fatalf("not dead: %+v", answer)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if c.code != "" {
				if answer.Error == nil || answer.Error.Code != c.code {
					t.Fatalf("answer %s, want error %s", answer.rendered(), c.code)
				}
				return
			}
			if answer.Error != nil || render(answer.OK) != c.ok {
				t.Fatalf("answer %s, want %s", answer.rendered(), c.ok)
			}
		})
	}
}

// §3.8: no answer within the deadline makes the testee dead, and a dead
// testee answers nothing more.
func TestDeadline(t *testing.T) {
	testee, _, err := fake(t, map[string][]string{"conn.receive": {"HANG"}})
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	if _, err := testee.Request("conn.receive", nil, 300*time.Millisecond); err == nil {
		t.Fatal("a hanging testee answered")
	}
	if time.Since(start) > 5*time.Second {
		t.Errorf("the deadline took %s", time.Since(start))
	}
	if _, err := testee.Request("reset", nil, time.Second); err == nil {
		t.Error("a dead testee took another request")
	}
}

// §3.2: ids count up from 1 with hello; the runner's id and op win over
// arguments of those names; the request keeps each number's spelling.
func TestRequests(t *testing.T) {
	testee, log, err := fake(t, map[string][]string{"conn.send": {`{"id":ID,"ok":{}}`}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testee.Request("conn.send", map[string]any{"id": "x", "op": "y", "n": value(t, `1e3`), "s": "<&>"}, time.Second); err != nil {
		t.Fatal(err)
	}
	sent := requests(t, log)
	if len(sent) != 2 || render(sent[0]["id"]) != "1" || sent[0]["op"] != "hello" {
		t.Fatalf("requests %v", sent)
	}
	if render(sent[1]["id"]) != "2" || sent[1]["op"] != "conn.send" || render(sent[1]["n"]) != "1e3" || sent[1]["s"] != "<&>" {
		t.Fatalf("request %v", sent[1])
	}
}

// §3.5: reset discards stderr; a reset error fails; bye ends the process.
func TestResetAndBye(t *testing.T) {
	testee, _, err := fake(t, map[string][]string{"conn.send": {"STDERR:noise"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testee.Request("conn.send", nil, time.Second); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for testee.Stderr() == "" && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if testee.Stderr() != "noise" {
		t.Fatalf("stderr %q", testee.Stderr())
	}
	if err := testee.Reset(); err != nil || testee.Stderr() != "" {
		t.Fatalf("reset: %v, stderr %q", err, testee.Stderr())
	}
	if !testee.Stop() || !testee.Exited() {
		t.Error("the testee did not answer bye and exit 0 by itself")
	}
	ignoring, _, err := fake(t, map[string][]string{"bye": {"HANG"}})
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	if ignoring.Stop() {
		t.Error("a testee that ignores bye stopped cleanly")
	}
	if time.Since(start) > 15*time.Second || !ignoring.Exited() {
		t.Errorf("stopping a testee that ignores bye took %s, exited %v", time.Since(start), ignoring.Exited())
	}
	failing, _, err := fake(t, map[string][]string{"reset": {`{"id":ID,"error":{"code":"internal"}}`}})
	if err != nil {
		t.Fatal(err)
	}
	if err := failing.Reset(); err == nil {
		t.Error("a reset error was accepted")
	}
}

// §3.8: a process that ended between requests is dead, and the runner
// starts a new one for the next case.
func TestExitBetweenRequests(t *testing.T) {
	testee, _, err := fake(t, map[string][]string{"conn.send": {"THEN_EXIT:" + okEmpty}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testee.Request("conn.send", nil, 5*time.Second); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for !testee.Exited() && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if err := testee.Dead(); err == nil || !strings.Contains(err.Error(), "exited") {
		t.Fatalf("dead: %v", err)
	}
}

// A testee command may be a wrapper whose child holds the streams: killing
// it ends the whole tree promptly.
func TestKillEndsTheTree(t *testing.T) {
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	script := filepath.Join(dir, "script.json")
	if err := os.WriteFile(script, []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	argv := []string{"sh", "-c", "\"$0\" -test.run='^$'; true", self}
	if runtime.GOOS == "windows" {
		argv = []string{"cmd", "/c", self, "-test.run=^$"}
	}
	testee, err := Start("wrapped", Command{Argv: argv}, map[string]string{"RUNNER_FAKE_TESTEE": script})
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	testee.Kill()
	if !testee.Exited() || time.Since(start) > 5*time.Second {
		t.Fatalf("killing a wrapped testee took %s, exited %v", time.Since(start), testee.Exited())
	}
}
