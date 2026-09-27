package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// Execute over the whole evidence set with the fake testee, which answers
// every op a scenario uses unsupported: one process serves both sides and
// every case; scope, optional diagnostics and applicability skip cases
// before anything runs; and the report records what section 9 asks.
func TestExecute(t *testing.T) {
	root := checkoutRoot(t)
	evidence, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	script, log := filepath.Join(dir, "script.json"), filepath.Join(dir, "requests.log")
	if err := os.WriteFile(script, []byte(`{}`), 0o644); err != nil {
		t.Fatal(err)
	}
	artifact := filepath.Join(dir, "artifact.bin")
	if err := os.WriteFile(artifact, []byte("bytes"), 0o644); err != nil {
		t.Fatal(err)
	}
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	config := &Config{
		Scope:          "core",
		Implementation: "fake",
		Implementations: map[string]Implementation{"fake": {
			Name: "fake", Version: "0", Revision: "r", Language: "go", Toolchain: "go",
			Artifacts: []string{"artifact.bin"},
			Testee:    Command{Argv: fakeCommand(self).Argv, Env: map[string]string{"RUNNER_FAKE_TESTEE": script, "RUNNER_FAKE_LOG": log}},
		}},
		Pairings:   [][2]string{{"fake", "fake"}},
		Transports: []Transport{{Name: "fake", Subprotocols: false}},
		dir:        dir,
	}
	report, err := Execute(config, root, evidence, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	hellos := 0
	for _, r := range requests(t, log) {
		if r["op"] == "hello" {
			hellos++
		}
	}
	if hellos != 1 {
		t.Errorf("%d processes for one implementation on both sides", hellos)
	}
	expected := 0
	for _, s := range evidence.Scenarios {
		expected++
		if s.Mirror {
			expected++
		}
	}
	if len(report.Cases) != expected {
		t.Fatalf("%d cases, want %d", len(report.Cases), expected)
	}
	results := map[string]int{}
	for _, c := range report.Cases {
		results[c.Result]++
		switch {
		case c.Scope == "tunnel" && c.Optional == "":
			if c.Result != Skip || c.Reason != "outside the claimed scope" || c.Required {
				t.Errorf("%s: %s %s", c.ID, c.Result, c.Reason)
			}
		case c.Optional != "":
			if c.Result != Skip || !strings.Contains(c.Reason, "not requested") || c.Required {
				t.Errorf("%s: %s %s", c.ID, c.Result, c.Reason)
			}
		case c.Applicability != "":
			if c.Result != Skip || !strings.Contains(c.Applicability, "subprotocols") {
				t.Errorf("%s: %s %s", c.ID, c.Result, c.Applicability)
			}
		default:
			if c.Result != Unsupported || !c.Required {
				t.Errorf("%s: %s %s", c.ID, c.Result, c.Reason)
			}
		}
		if len(c.SHA256) != 64 || !strings.HasPrefix(c.File, "scenarios/") {
			t.Errorf("%s: file %s %s", c.ID, c.File, c.SHA256)
		}
	}
	if results[Unsupported] == 0 || results[Skip] == 0 {
		t.Errorf("results %v", results)
	}
	if report.Claim.Result != "not supported" || report.Claim.Counts[Unsupported] == 0 {
		t.Errorf("claim %+v", report.Claim)
	}
	if len(report.Claim.Limitations) != 1 {
		t.Errorf("limitations %v", report.Claim.Limitations)
	}
	if report.Implementation.Hello == nil || report.Implementation.Hello.Language != "fake" {
		t.Errorf("hello %+v", report.Implementation.Hello)
	}
	sum := sha256.Sum256([]byte("bytes"))
	if len(report.Implementation.Artifacts) != 1 || report.Implementation.Artifacts[0].SHA256 != hex.EncodeToString(sum[:]) {
		t.Errorf("artifacts %+v", report.Implementation.Artifacts)
	}
	if report.Contract.Edition != 1 || report.Contract.ContractDigest != evidence.ContractDigest || report.Evidence.EvidenceDigest != evidence.EvidenceDigest {
		t.Errorf("identities %+v %+v", report.Contract, report.Evidence)
	}
	if report.Protocol.NormativeDigest != targetDigest || report.Configuration.Bounds != "default" || !report.Configuration.Listen {
		t.Errorf("report %+v %+v", report.Protocol, report.Configuration)
	}
	data, err := json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	var top map[string]json.RawMessage
	if err := json.Unmarshal(data, &top); err != nil {
		t.Fatal(err)
	}
	for _, member := range []string{"protocol", "scope", "roles", "transports", "configuration", "implementation", "counterparts", "pairings", "runner", "contract", "evidence", "cases", "claim"} {
		if _, ok := top[member]; !ok {
			t.Errorf("the report lacks %s", member)
		}
	}
	if report.Implementation.Command.Argv[0] != self {
		t.Errorf("the report records the command %+v", report.Implementation.Command)
	}

	// -only: the unselected required cases are skips that fail the claim.
	only, err := Execute(config, root, evidence, regexp.MustCompile(`^seam/`), nil)
	if err != nil {
		t.Fatal(err)
	}
	notSelected := 0
	for _, c := range only.Cases {
		if c.Reason == "not selected for this run" {
			notSelected++
		}
	}
	if notSelected == 0 || only.Claim.Result != "not supported" {
		t.Errorf("-only: %d not selected, claim %s", notSelected, only.Claim.Result)
	}
}

// A testee that cannot start is a harness failure of every case it was to run.
func TestExecuteStartFailure(t *testing.T) {
	root := checkoutRoot(t)
	evidence, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	config := &Config{
		Scope: "core", Implementation: "missing",
		Implementations: map[string]Implementation{"missing": {Testee: Command{Argv: []string{filepath.Join(t.TempDir(), "no-such-testee")}}}},
		Pairings:        [][2]string{{"missing", "missing"}},
		Transports:      []Transport{{Name: "none"}},
		dir:             t.TempDir(),
	}
	report, err := Execute(config, root, evidence, regexp.MustCompile(`^seam/`), nil)
	if err != nil {
		t.Fatal(err)
	}
	harness := 0
	for _, c := range report.Cases {
		if c.Result == Harness {
			harness++
			if !strings.Contains(c.Reason, "could not be started") {
				t.Errorf("%s: %s", c.ID, c.Reason)
			}
		}
	}
	if harness == 0 || report.Claim.Counts[Harness] != harness {
		t.Errorf("%d harness failures, claim %+v", harness, report.Claim)
	}
}

// §3.8: a testee that dies is ended, and a new process serves the next case.
func TestExecuteRestartsADeadTestee(t *testing.T) {
	root := checkoutRoot(t)
	evidence, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	script, log := filepath.Join(dir, "script.json"), filepath.Join(dir, "requests.log")
	if err := os.WriteFile(script, []byte(`{"conn.listen":["EXIT"]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	config := &Config{
		Scope: "core", Implementation: "fake",
		Implementations: map[string]Implementation{"fake": {Testee: Command{Argv: fakeCommand(self).Argv, Env: map[string]string{"RUNNER_FAKE_TESTEE": script, "RUNNER_FAKE_LOG": log}}}},
		Pairings:        [][2]string{{"fake", "fake"}},
		Transports:      []Transport{{Name: "fake"}},
		dir:             dir,
	}
	report, err := Execute(config, root, evidence, regexp.MustCompile(`^seam/`), nil)
	if err != nil {
		t.Fatal(err)
	}
	harness := 0
	for _, c := range report.Cases {
		if c.Result == Harness {
			harness++
		}
	}
	hellos := 0
	for _, r := range requests(t, log) {
		if r["op"] == "hello" {
			hellos++
		}
	}
	if harness < 2 || hellos != harness {
		t.Fatalf("%d harness cases, %d processes", harness, hellos)
	}
}

func TestReleaseStatus(t *testing.T) {
	root := checkoutRoot(t)
	evidence, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	if got := releaseStatus(root, evidence.ContractDigest); got != "released" {
		t.Errorf("the checkout's own contract is %s; editions.json does not record its contractDigest", got)
	}
	if got := releaseStatus(root, strings.Repeat("0", 64)); got != "draft" {
		t.Errorf("an unrecorded contractDigest is %s", got)
	}
	if got := releaseStatus(t.TempDir(), evidence.ContractDigest); got != "draft" {
		t.Errorf("a checkout without editions.json is %s", got)
	}
}
