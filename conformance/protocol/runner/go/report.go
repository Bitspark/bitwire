package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"
)

// Config is one claim run (CONTRACT.md §8, §9): the implementation under
// test, its counterparts, the pairings and transports, and the scope.
type Config struct {
	// Scope is the claimed scope: "core", or "core and tunnel".
	Scope string `json:"scope"`
	// Implementation names the implementation under test in Implementations.
	Implementation  string                    `json:"implementation"`
	Implementations map[string]Implementation `json:"implementations"`
	// Pairings are ordered: the implementation on side a, then on side b.
	Pairings   [][2]string `json:"pairings"`
	Transports []Transport `json:"transports"`
	// Optional names the optional diagnostics to run: observer, defect.
	Optional []string `json:"optional,omitempty"`
	dir      string
}

// Implementation is an implementation that takes part, and how its testee runs.
type Implementation struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	Revision string `json:"revision"`
	Language string `json:"language"`
	// Toolchain names what built and runs the testee.
	Toolchain string `json:"toolchain"`
	// Artifacts are the files run; the runner records their digests.
	Artifacts []string `json:"artifacts"`
	// Configuration is where it departs from the default bounds, or "default".
	Configuration any `json:"configuration"`
	// Listen is false when the implementation under test does not accept
	// connections (§8.2). Only the implementation under test declares it.
	Listen *bool   `json:"listen,omitempty"`
	Testee Command `json:"testee"`
}

func (i Implementation) listens() bool { return i.Listen == nil || *i.Listen }

// Transport is one claimed transport: how each testee is configured for
// it, and whether it negotiates subprotocols.
type Transport struct {
	Name         string            `json:"name"`
	Env          map[string]string `json:"env,omitempty"`
	Subprotocols bool              `json:"subprotocols"`
}

// ReadConfig reads a run configuration; relative paths in it are relative
// to its own directory.
func ReadConfig(file string) (*Config, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	var c Config
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&c); err != nil {
		return nil, fmt.Errorf("%s: %w", file, err)
	}
	c.dir, err = filepath.Abs(filepath.Dir(file))
	if err != nil {
		return nil, err
	}
	if c.Scope != "core" && c.Scope != "core and tunnel" {
		return nil, fmt.Errorf("%s: the scope is core, or core and tunnel", file)
	}
	if _, ok := c.Implementations[c.Implementation]; !ok {
		return nil, fmt.Errorf("%s: the implementation under test, %q, is not among the implementations", file, c.Implementation)
	}
	for _, pairing := range c.Pairings {
		for _, name := range pairing {
			if _, ok := c.Implementations[name]; !ok {
				return nil, fmt.Errorf("%s: pairing names %q, which is not among the implementations", file, name)
			}
		}
	}
	for id, i := range c.Implementations {
		if id != c.Implementation && i.Listen != nil {
			return nil, fmt.Errorf("%s: %q declares listen, which only the implementation under test declares", file, id)
		}
	}
	if len(c.Transports) == 0 {
		return nil, fmt.Errorf("%s: a run claims at least one transport", file)
	}
	// A case is identified by its id, pairing and transport name (§9).
	pairs := map[[2]string]bool{}
	for _, pairing := range c.Pairings {
		if pairs[pairing] {
			return nil, fmt.Errorf("%s: the pairing %q is listed twice", file, pairing)
		}
		pairs[pairing] = true
	}
	names := map[string]bool{}
	for _, t := range c.Transports {
		if t.Name == "" || names[t.Name] {
			return nil, fmt.Errorf("%s: each transport has its own nonempty name; %q is not", file, t.Name)
		}
		names[t.Name] = true
	}
	for _, kind := range c.Optional {
		if kind != "observer" && kind != "defect" {
			return nil, fmt.Errorf("%s: optional diagnostics are observer and defect", file)
		}
	}
	return &c, nil
}

// resolve fills a configuration string's placeholders: {config} is the
// configuration's directory, {checkout} the checkout, {exe} ".exe" on Windows.
func (c *Config) resolve(s, checkout string) string {
	exe := ""
	if runtime.GOOS == "windows" {
		exe = ".exe"
	}
	return strings.NewReplacer("{config}", c.dir, "{checkout}", checkout, "{exe}", exe).Replace(s)
}

func (c *Config) command(i Implementation, checkout string) Command {
	out := Command{Env: map[string]string{}}
	for _, arg := range i.Testee.Argv {
		out.Argv = append(out.Argv, c.resolve(arg, checkout))
	}
	out.Cwd = c.dir
	if i.Testee.Cwd != "" {
		out.Cwd = c.resolve(i.Testee.Cwd, checkout)
		if !filepath.IsAbs(out.Cwd) {
			out.Cwd = filepath.Join(c.dir, out.Cwd)
		}
	}
	for key, value := range i.Testee.Env {
		out.Env[key] = c.resolve(value, checkout)
	}
	return out
}

// Report is one claim run's report (§9).
type Report struct {
	Protocol       protocolIdentity `json:"protocol"`
	Scope          string           `json:"scope"`
	Roles          []string         `json:"roles"`
	Transports     []Transport      `json:"transports"`
	Configuration  reportConfig     `json:"configuration"`
	Implementation reportImpl       `json:"implementation"`
	Counterparts   []reportImpl     `json:"counterparts"`
	Pairings       []reportPairing  `json:"pairings"`
	Runner         reportRunner     `json:"runner"`
	Contract       reportContract   `json:"contract"`
	Evidence       reportEvidence   `json:"evidence"`
	Cases          []reportCase     `json:"cases"`
	Claim          reportClaim      `json:"claim"`
	Time           string           `json:"time"`
	Platform       string           `json:"platform"`
}

type reportConfig struct {
	Bounds any  `json:"bounds"`
	Listen bool `json:"listen"`
}

type reportImpl struct {
	ID        string           `json:"id"`
	Command   Command          `json:"command"`
	Name      string           `json:"name"`
	Version   string           `json:"version"`
	Revision  string           `json:"revision"`
	Language  string           `json:"language"`
	Toolchain string           `json:"toolchain"`
	Artifacts []reportArtifact `json:"artifacts"`
	Hello     *Hello           `json:"hello"`
}

type reportArtifact struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type reportPairing struct {
	A string `json:"a"`
	B string `json:"b"`
}

type reportRunner struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	Revision string `json:"revision"`
	Modified bool   `json:"modified"`
}

type reportContract struct {
	Edition        int    `json:"edition"`
	ContractDigest string `json:"contractDigest"`
	Status         string `json:"status"`
}

type reportEvidence struct {
	EvidenceDigest    string   `json:"evidenceDigest"`
	OptionalRequested []string `json:"optionalRequested"`
}

type reportCase struct {
	ID        string        `json:"id"`
	File      string        `json:"file"`
	SHA256    string        `json:"sha256"`
	Scope     string        `json:"scope"`
	Optional  string        `json:"optional,omitempty"`
	Required  bool          `json:"required"`
	Pairing   reportPairing `json:"pairing"`
	Transport string        `json:"transport"`
	Result    string        `json:"result"`
	Reason    string        `json:"reason,omitempty"`
	// Applicability is set on a skip that is a named limitation (§8.2).
	Applicability string   `json:"applicability,omitempty"`
	Failure       *Failure `json:"failure,omitempty"`
}

type reportClaim struct {
	Result      string         `json:"result"`
	Counts      map[string]int `json:"counts"`
	Limitations []string       `json:"limitations"`
	Reasons     []string       `json:"reasons,omitempty"`
}

// runnerVersion identifies this runner program; its source revision is
// read from the checkout.
const runnerVersion = "0.1.0"

// Execute runs every case the configuration asks for and builds the report.
func Execute(c *Config, checkout string, evidence *Evidence, only *regexp.Regexp, log io.Writer) (*Report, error) {
	report := &Report{
		Protocol:   protocolIdentity{Revision: targetRevision, NormativeDigest: targetDigest},
		Scope:      c.Scope,
		Roles:      []string{"client", "server"},
		Transports: c.Transports,
		Runner:     runnerIdentity(checkout),
		Contract:   reportContract{Edition: edition, ContractDigest: evidence.ContractDigest, Status: "draft"},
		Evidence:   reportEvidence{EvidenceDigest: evidence.EvidenceDigest, OptionalRequested: append([]string{}, c.Optional...)},
		Time:       time.Now().UTC().Format(time.RFC3339),
		Platform:   runtime.GOOS + "/" + runtime.GOARCH,
	}
	under := c.Implementations[c.Implementation]
	report.Configuration = reportConfig{Bounds: under.Configuration, Listen: under.listens()}
	if report.Configuration.Bounds == nil {
		report.Configuration.Bounds = "default"
	}
	impls := map[string]*reportImpl{}
	for id, i := range c.Implementations {
		entry := &reportImpl{ID: id, Command: c.command(i, checkout), Name: i.Name, Version: i.Version, Revision: i.Revision, Language: i.Language, Toolchain: i.Toolchain, Artifacts: []reportArtifact{}}
		for _, artifact := range i.Artifacts {
			file := c.resolve(artifact, checkout)
			if !filepath.IsAbs(file) {
				file = filepath.Join(c.dir, file)
			}
			data, err := os.ReadFile(file)
			if err != nil {
				return nil, fmt.Errorf("the %s artifact %s: %w", id, artifact, err)
			}
			sum := sha256.Sum256(data)
			entry.Artifacts = append(entry.Artifacts, reportArtifact{Path: artifact, SHA256: hex.EncodeToString(sum[:])})
		}
		impls[id] = entry
	}
	for _, p := range c.Pairings {
		report.Pairings = append(report.Pairings, reportPairing{A: p[0], B: p[1]})
	}
	requested := map[string]bool{}
	for _, kind := range c.Optional {
		requested[kind] = true
	}
	for _, transport := range c.Transports {
		testees := map[string]*Testee{}
		failed := map[string]error{}
		get := func(id string) (*Testee, error) {
			if t := testees[id]; t != nil && t.Dead() == nil {
				return t, nil
			}
			if t := testees[id]; t != nil {
				t.Kill()
				delete(testees, id)
			}
			if err := failed[id]; err != nil {
				return nil, err
			}
			t, err := Start(id, c.command(c.Implementations[id], checkout), transport.Env)
			if err != nil {
				failed[id] = err
				return nil, err
			}
			if impls[id].Hello == nil {
				hello := t.Hello
				impls[id].Hello = &hello
			}
			testees[id] = t
			return t, nil
		}
		helloOf := func(id string, t *Testee) Hello {
			if id == c.Implementation && !c.Implementations[id].listens() {
				return t.Hello.without("listen")
			}
			return t.Hello
		}
		for _, pairing := range c.Pairings {
			for _, scenario := range evidence.Scenarios {
				variants := []Scenario{scenario}
				if scenario.Mirror {
					variants = append(variants, scenario.Mirrored())
				}
				for _, s := range variants {
					entry := reportCase{
						ID: s.ID(), File: s.File, SHA256: s.SHA256, Scope: s.Scope, Optional: s.Optional,
						Required: required(c.Scope, s), Pairing: reportPairing{A: pairing[0], B: pairing[1]}, Transport: transport.Name,
					}
					if reason := skipReason(c, s, pairing, transport, requested, only); reason != "" {
						entry.Result, entry.Reason = Skip, reason
					} else if reason := inapplicable(c, s, pairing, transport); reason != "" {
						entry.Result, entry.Reason, entry.Applicability = Skip, reason, reason
					} else {
						ta, errA := get(pairing[0])
						tb, errB := get(pairing[1])
						switch {
						case errA != nil:
							entry.Result, entry.Reason = Harness, "the testee on side a could not be started: "+errA.Error()
						case errB != nil:
							entry.Result, entry.Reason = Harness, "the testee on side b could not be started: "+errB.Error()
						default:
							hello := map[string]Hello{"a": helloOf(pairing[0], ta), "b": helloOf(pairing[1], tb)}
							outcome := Run(ta, tb, hello, s)
							entry.Result, entry.Reason, entry.Failure = outcome.Result, outcome.Reason, outcome.Failure
						}
					}
					report.Cases = append(report.Cases, entry)
					if log != nil {
						fmt.Fprintf(log, "%-11s %s [%s | %s, %s]%s\n", strings.ToUpper(entry.Result), entry.ID, pairing[0], pairing[1], transport.Name, suffix(entry.Reason))
					}
				}
			}
		}
		for _, t := range testees {
			_ = t.Stop()
		}
	}
	report.Implementation = *impls[c.Implementation]
	report.Counterparts = []reportImpl{}
	paired := map[string]bool{}
	for _, p := range c.Pairings {
		paired[p[0]], paired[p[1]] = true, true
	}
	ids := make([]string, 0, len(impls))
	for id := range impls {
		if id != c.Implementation && paired[id] {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	for _, id := range ids {
		report.Counterparts = append(report.Counterparts, *impls[id])
	}
	report.Claim = claim(c, report.Cases)
	return report, nil
}

func suffix(reason string) string {
	if reason == "" {
		return ""
	}
	first, _, _ := strings.Cut(reason, "\n")
	return ": " + first
}

// required is whether a scenario's cases count toward the claimed scope (§8.1).
func required(scope string, s Scenario) bool {
	if s.Optional != "" {
		return false
	}
	return s.Scope == "core" || (scope == "core and tunnel" && s.Scope == "tunnel")
}

// skipReason is why the runner does not run a case other than
// applicability: outside the claimed scope, an optional diagnostic not
// requested, or not selected (§7.1).
func skipReason(c *Config, s Scenario, pairing [2]string, transport Transport, requested map[string]bool, only *regexp.Regexp) string {
	if s.Scope == "tunnel" && c.Scope != "core and tunnel" && s.Optional == "" {
		return "outside the claimed scope"
	}
	if s.Optional != "" && !requested[s.Optional] {
		return "an optional " + s.Optional + " diagnostic that was not requested"
	}
	if only != nil && !only.MatchString(s.ID()) {
		return "not selected for this run"
	}
	return ""
}

// inapplicable is the limitation that makes a case not applicable (§8.2), or "".
func inapplicable(c *Config, s Scenario, pairing [2]string, transport Transport) string {
	for _, step := range s.Steps {
		if list, ok := step.Args["subprotocols"].([]any); ok && len(list) > 0 && !transport.Subprotocols {
			return "the " + transport.Name + " transport cannot negotiate subprotocols"
		}
	}
	under := c.Implementations[c.Implementation]
	if !under.listens() {
		for _, step := range s.Steps {
			if step.Op != "conn.listen" && step.Op != "peer.listen" {
				continue
			}
			if (step.On == "a" && pairing[0] == c.Implementation) || (step.On == "b" && pairing[1] == c.Implementation) {
				return "the implementation under test does not accept connections"
			}
		}
	}
	return ""
}

// claim applies the claim rule (§8.4) to a run's cases.
func claim(c *Config, cases []reportCase) reportClaim {
	out := reportClaim{Counts: map[string]int{Pass: 0, Fail: 0, Unsupported: 0, Skip: 0, Harness: 0}, Limitations: []string{}}
	onA, onB := false, false
	for _, p := range c.Pairings {
		onA = onA || p[0] == c.Implementation
		onB = onB || p[1] == c.Implementation
	}
	if !onA || !onB {
		out.Reasons = append(out.Reasons, "the pairings do not place the implementation under test on both sides")
	}
	limitations := map[string]bool{}
	failed := 0
	for _, entry := range cases {
		if !entry.Required {
			continue
		}
		out.Counts[entry.Result]++
		switch {
		case entry.Result == Pass:
		case entry.Result == Skip && entry.Applicability != "":
			if !limitations[entry.Applicability] {
				limitations[entry.Applicability] = true
				out.Limitations = append(out.Limitations, entry.Applicability)
			}
		default:
			failed++
		}
	}
	if failed > 0 {
		out.Reasons = append(out.Reasons, fmt.Sprintf("%d required cases did not pass", failed))
	}
	out.Result = "supported"
	if len(out.Reasons) > 0 {
		out.Result = "not supported"
	}
	return out
}
