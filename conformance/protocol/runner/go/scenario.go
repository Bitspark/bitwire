package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"math"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// The protocol identity edition 1 targets (CONTRACT.md §1).
const (
	edition        = 1
	targetRevision = "bitwire/1"
	targetDigest   = "7797682b0f05f86c508eafbd3be23c2084acd2f5cfc766922f9372b652dc416e"
)

// The places, relative to the checkout, that the runner reads.
const (
	contractDir = "conformance/protocol"
	bundleDir   = "protocol/bitwire-1"
	tablesDir   = "protocol/bitwire-1/source/conformance"
)

var contractFiles = []string{"CONTRACT.md", "scenario.schema.json", "selection.json"}

// Scenario is one scenario as a case runs it: a foreach expanded into one
// Scenario per kept row, the row bound under RowAs.
type Scenario struct {
	Name     string
	Layer    string
	Scope    string
	Optional string
	Needs    []string
	Mirror   bool
	Steps    []Step
	Row      map[string]any
	RowAs    string
	// File is the scenario's path under conformance/protocol/, and SHA256
	// the file's digest.
	File   string
	SHA256 string
}

// ID is the case's name without its pairing and transport (§9).
func (s Scenario) ID() string { return s.Layer + "/" + s.Name }

// Step is one op and what is held against its answer (§5.2).
type Step struct {
	On          string
	Op          string
	Args        map[string]any
	Bind        any
	Expect      any
	HasExpect   bool
	ExpectError map[string]any
	Assert      map[string]any
	Repeat      *Repeat
	// source is the step's index in its scenario, and part its position
	// within a runner op's expansion, or -1 for the scenario's own step.
	source, part int
}

// Repeat is a step's repeat (§7.2).
type Repeat struct {
	Max   int
	Until string
}

// Evidence is a loaded evidence set with the identities a report records.
type Evidence struct {
	Scenarios      []Scenario
	ContractDigest string
	EvidenceDigest string
}

// Load reads the contract and every scenario under the checkout, verifying
// the protocol bundle it reads tables from, and refuses the whole set when
// any scenario fails a load check (§5.5).
func Load(checkout string) (*Evidence, error) {
	if err := verifyBundle(checkout); err != nil {
		return nil, err
	}
	home := filepath.Join(checkout, filepath.FromSlash(contractDir))
	schema, err := loadSchema(filepath.Join(home, "scenario.schema.json"))
	if err != nil {
		return nil, fmt.Errorf("the scenario schema: %w", err)
	}
	contract, err := digestFiles(home, contractFiles)
	if err != nil {
		return nil, err
	}
	var files []string
	err = filepath.WalkDir(filepath.Join(home, "scenarios"), func(p string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		relative, err := filepath.Rel(home, p)
		if err != nil {
			return err
		}
		files = append(files, filepath.ToSlash(relative))
		return nil
	})
	if err != nil {
		return nil, err
	}
	evidence, err := digestFiles(home, files)
	if err != nil {
		return nil, err
	}
	var scenarios []Scenario
	for _, file := range files {
		if !strings.HasSuffix(file, ".json") {
			return nil, fmt.Errorf("%s: the evidence set holds only scenarios", file)
		}
		data, err := os.ReadFile(filepath.Join(home, filepath.FromSlash(file)))
		if err != nil {
			return nil, err
		}
		expanded, err := parse(checkout, file, data, schema)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", file, err)
		}
		scenarios = append(scenarios, expanded...)
	}
	sort.SliceStable(scenarios, func(i, j int) bool {
		if scenarios[i].Layer != scenarios[j].Layer {
			return layerRank[scenarios[i].Layer] < layerRank[scenarios[j].Layer]
		}
		return scenarios[i].Name < scenarios[j].Name
	})
	// Case ids are unique: a mirrored variant's name counts (§5.8, §9).
	seen := map[string]string{}
	for _, s := range scenarios {
		ids := []string{s.ID()}
		if s.Mirror {
			ids = append(ids, s.Mirrored().ID())
		}
		for _, id := range ids {
			if other, dup := seen[id]; dup {
				return nil, fmt.Errorf("%s: case %q is also declared in %s", s.File, id, other)
			}
			seen[id] = s.File
		}
	}
	return &Evidence{Scenarios: scenarios, ContractDigest: contract, EvidenceDigest: evidence}, nil
}

var layerRank = map[string]int{"seam": 0, "peer": 1, "tunnel": 2}

// familiesOf is each layer's op families (§5.3); pair.* is the runner's.
var familiesOf = map[string][]string{
	"seam":   {"conn", "pair"},
	"peer":   {"conn", "peer", "call", "pair"},
	"tunnel": {"conn", "peer", "call", "tunnel", "pair"},
}

var scopeOf = map[string]string{"seam": "core", "peer": "core", "tunnel": "tunnel"}

// excluded reports why an op, or a canned behaviour, is outside edition 1 (§4.5).
func excluded(step Step) string {
	family, _, _ := strings.Cut(step.Op, ".")
	switch {
	case step.Op == "peer.identity", step.Op == "peer.check_identity":
		return "the identity exchange"
	case step.Op == "peer.recorded_wire_witness":
		return "a test-only recorder"
	case family == "live":
		return "the live layer"
	case family == "gen", family == "client", family == "server":
		return "generated code"
	}
	if behavior, ok := step.Args["behavior"].(map[string]any); ok && behavior["kind"] == "through" {
		return "the live layer's through behaviour"
	}
	return ""
}

func observes(step Step) bool {
	if step.Op == "peer.observed" {
		return true
	}
	for _, key := range []string{"options", "server_options", "client_options"} {
		if options, ok := step.Args[key].(map[string]any); ok && options["observe"] == true {
			return true
		}
	}
	return false
}

type scenarioFile struct {
	Name     string            `json:"name"`
	Layer    string            `json:"layer"`
	Protocol protocolIdentity  `json:"protocol"`
	Scope    string            `json:"scope"`
	Optional string            `json:"optional"`
	Needs    []string          `json:"needs"`
	Mirror   bool              `json:"mirror"`
	Foreach  *foreachClause    `json:"foreach"`
	Steps    []json.RawMessage `json:"steps"`
}

type protocolIdentity struct {
	Revision        string `json:"revision"`
	NormativeDigest string `json:"normativeDigest"`
}

type foreachClause struct {
	Table string          `json:"table"`
	As    string          `json:"as"`
	Where json.RawMessage `json:"where"`
}

func loadSchema(file string) (*jsonschema.Schema, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	document, err := jsonschema.UnmarshalJSON(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	compiler := jsonschema.NewCompiler()
	compiler.DefaultDraft(jsonschema.Draft2020)
	if err := compiler.AddResource("scenario.schema.json", document); err != nil {
		return nil, err
	}
	return compiler.Compile("scenario.schema.json")
}

func parse(checkout, file string, data []byte, schema *jsonschema.Schema) ([]Scenario, error) {
	document, err := jsonschema.UnmarshalJSON(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	if err := schema.Validate(document); err != nil {
		return nil, fmt.Errorf("does not fit the scenario schema: %v", err)
	}
	var sf scenarioFile
	if err := json.Unmarshal(data, &sf); err != nil {
		return nil, err
	}
	if sf.Protocol.Revision != targetRevision || sf.Protocol.NormativeDigest != targetDigest {
		return nil, fmt.Errorf("names protocol (%s, %s), not the target (%s, %s)", sf.Protocol.Revision, sf.Protocol.NormativeDigest, targetRevision, targetDigest)
	}
	if layer := path.Base(path.Dir(file)); sf.Layer != layer || path.Dir(path.Dir(file)) != "scenarios" {
		return nil, fmt.Errorf("declares layer %s but lies under %s", sf.Layer, path.Dir(file))
	}
	if sf.Scope != scopeOf[sf.Layer] {
		return nil, fmt.Errorf("a %s scenario has scope %s, not %s", sf.Layer, sf.Scope, scopeOf[sf.Layer])
	}
	steps := make([]Step, 0, len(sf.Steps))
	for i, raw := range sf.Steps {
		step, err := parseStep(raw)
		if err != nil {
			return nil, fmt.Errorf("step %d: %w", i, err)
		}
		if err := checkStep(sf, step); err != nil {
			return nil, fmt.Errorf("step %d: %w", i, err)
		}
		steps = append(steps, step)
	}
	sum := sha256.Sum256(data)
	base := Scenario{
		Name: sf.Name, Layer: sf.Layer, Scope: sf.Scope, Optional: sf.Optional, Needs: sf.Needs,
		Mirror: sf.Mirror, Steps: steps, File: file, SHA256: hex.EncodeToString(sum[:]),
	}
	if err := holdDeclared(base); err != nil {
		return nil, err
	}
	for _, need := range sf.Needs {
		if need == "observer" && sf.Optional != "observer" {
			return nil, fmt.Errorf("needs the observer but is not marked optional observer")
		}
	}
	if sf.Foreach == nil {
		return []Scenario{base}, nil
	}
	if keywords[sf.Foreach.As] {
		return nil, fmt.Errorf("foreach binds %s, a keyword of the matching language", sf.Foreach.As)
	}
	where := map[string]any{}
	if len(sf.Foreach.Where) != 0 {
		decoded, err := decode(sf.Foreach.Where)
		if err != nil {
			return nil, fmt.Errorf("foreach.where: %w", err)
		}
		where, _ = decoded.(map[string]any)
	}
	rows, err := tableRows(checkout, sf.Foreach.Table, where)
	if err != nil {
		return nil, fmt.Errorf("foreach: %w", err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("foreach over %s selects no row", sf.Foreach.Table)
	}
	out := make([]Scenario, 0, len(rows))
	for i, row := range rows {
		s := base
		s.Row, s.RowAs = row, sf.Foreach.As
		s.Name = fmt.Sprintf("%s[%s]", base.Name, rowLabel(row, i))
		out = append(out, s)
	}
	return out, nil
}

// checkStep holds one step to the load rules that the schema does not
// express (§5.5).
func checkStep(sf scenarioFile, step Step) error {
	if reason := excluded(step); reason != "" {
		return fmt.Errorf("%s is excluded from edition 1: %s", step.Op, reason)
	}
	family, _, _ := strings.Cut(step.Op, ".")
	allowed := false
	for _, f := range familiesOf[sf.Layer] {
		allowed = allowed || f == family
	}
	if !allowed {
		return fmt.Errorf("%s does not belong to the %s layer", step.Op, sf.Layer)
	}
	if observes(step) && sf.Optional == "" {
		return fmt.Errorf("%s asks for the observer in a required scenario", step.Op)
	}
	if step.Op == "peer.observed" && step.Repeat != nil && step.Repeat.Until == "match" && step.Args["drain"] != false {
		return fmt.Errorf("peer.observed repeated until match must set drain: false")
	}
	for _, member := range []string{"id", "op"} {
		if _, ok := step.Args[member]; ok {
			return fmt.Errorf("an argument is named %s, which is the request's own member", member)
		}
	}
	for _, name := range boundNames(step) {
		if keywords[name] {
			return fmt.Errorf("binds %s, a keyword of the matching language", name)
		}
	}
	return checkRunnerStep(step)
}

// boundNames is every name a step binds: through bind, and through $bind:
// in its expectations (§6.7).
func boundNames(step Step) []string {
	var names []string
	switch b := step.Bind.(type) {
	case string:
		names = append(names, b)
	case map[string]any:
		for _, name := range b {
			if s, ok := name.(string); ok {
				names = append(names, s)
			}
		}
	}
	var walk func(v any)
	walk = func(v any) {
		switch x := v.(type) {
		case string:
			if name, ok := strings.CutPrefix(x, "$bind:"); ok {
				names = append(names, name)
			}
		case map[string]any:
			for _, member := range x {
				walk(member)
			}
		case []any:
			for _, member := range x {
				walk(member)
			}
		}
	}
	walk(step.Expect)
	walk(step.ExpectError)
	return names
}

func parseStep(raw json.RawMessage) (Step, error) {
	var members map[string]json.RawMessage
	if err := json.Unmarshal(raw, &members); err != nil {
		return Step{}, err
	}
	decoded, err := decode(raw)
	if err != nil {
		return Step{}, err
	}
	object := decoded.(map[string]any)
	step := Step{On: object["on"].(string), Op: object["op"].(string)}
	if args, ok := object["args"].(map[string]any); ok {
		step.Args = args
	}
	step.Bind = object["bind"]
	if _, ok := members["expect"]; ok {
		step.Expect, step.HasExpect = object["expect"], true
	}
	if e, ok := object["expect_error"].(map[string]any); ok {
		step.ExpectError = e
	}
	if a, ok := object["assert"].(map[string]any); ok {
		step.Assert = a
	}
	if r, ok := object["repeat"].(map[string]any); ok {
		// JSON Schema's integer admits any integral number, such as 2.0.
		max, err := r["max"].(json.Number).Float64()
		if err != nil || max != math.Trunc(max) || max < 1 || max > 1e6 {
			return Step{}, fmt.Errorf("repeat.max is %s", r["max"])
		}
		until, _ := r["until"].(string)
		step.Repeat = &Repeat{Max: int(max), Until: until}
	}
	return step, nil
}

// rowLabel names a kept row: its name when that is a string, and otherwise
// its index among the kept rows (§5.7).
func rowLabel(row map[string]any, index int) string {
	if name, ok := row["name"].(string); ok {
		return name
	}
	return fmt.Sprint(index)
}

// tableRows reads a normative table's rows and keeps those whose members
// equal where's; a member a row lacks compares as null (§5.7).
func tableRows(checkout, table string, where map[string]any) ([]map[string]any, error) {
	data, err := os.ReadFile(filepath.Join(checkout, filepath.FromSlash(tablesDir), filepath.FromSlash(table)))
	if err != nil {
		return nil, err
	}
	decoded, err := decode(data)
	if err != nil {
		return nil, err
	}
	object, _ := decoded.(map[string]any)
	rows, ok := object["rows"].([]any)
	if !ok {
		return nil, fmt.Errorf("%s holds no rows", table)
	}
	var out []map[string]any
	for _, r := range rows {
		row, ok := r.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("%s: a row is not an object", table)
		}
		keep := true
		for key, want := range where {
			if !equal(want, row[key]) {
				keep = false
			}
		}
		if keep {
			out = append(out, row)
		}
	}
	return out, nil
}

// Mirrored is the scenario with a and b exchanged (§5.8).
func (s Scenario) Mirrored() Scenario {
	m := s
	m.Name = s.Name + " (mirrored)"
	m.Steps = make([]Step, len(s.Steps))
	for i, step := range s.Steps {
		m.Steps[i] = step
		switch step.On {
		case "a":
			m.Steps[i].On = "b"
		case "b":
			m.Steps[i].On = "a"
		default:
			m.Steps[i] = mirrorRunnerStep(step)
		}
	}
	return m
}

// digestFiles is SCOPE.md's digest procedure over files relative to home:
// the SHA-256 of "sha256  path\n" entries in ascending byte order of path.
func digestFiles(home string, files []string) (string, error) {
	sorted := append([]string(nil), files...)
	sort.Strings(sorted)
	var entries strings.Builder
	for _, file := range sorted {
		data, err := os.ReadFile(filepath.Join(home, filepath.FromSlash(file)))
		if err != nil {
			return "", err
		}
		sum := sha256.Sum256(data)
		fmt.Fprintf(&entries, "%s  %s\n", hex.EncodeToString(sum[:]), file)
	}
	sum := sha256.Sum256([]byte(entries.String()))
	return hex.EncodeToString(sum[:]), nil
}

// verifyBundle holds the protocol bundle to the target identity: the
// manifest's normativeDigest is the target and is its normative files'
// digest, and every normative file on disk has its recorded bytes. The
// tables the runner reads are among them.
func verifyBundle(checkout string) error {
	home := filepath.Join(checkout, filepath.FromSlash(bundleDir))
	data, err := os.ReadFile(filepath.Join(home, "manifest.json"))
	if err != nil {
		return fmt.Errorf("the protocol bundle: %w", err)
	}
	var manifest struct {
		Revision        string `json:"revision"`
		NormativeDigest string `json:"normativeDigest"`
		Files           []struct {
			Path     string `json:"path"`
			Category string `json:"category"`
			SHA256   string `json:"sha256"`
		} `json:"files"`
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return fmt.Errorf("the protocol manifest: %w", err)
	}
	if manifest.Revision != targetRevision || manifest.NormativeDigest != targetDigest {
		return fmt.Errorf("the protocol bundle is (%s, %s), not the target (%s, %s)", manifest.Revision, manifest.NormativeDigest, targetRevision, targetDigest)
	}
	var normative []string
	recorded := map[string]string{}
	for _, file := range manifest.Files {
		if file.Category != "normative" {
			continue
		}
		normative = append(normative, file.Path)
		recorded[file.Path] = file.SHA256
		actual, err := os.ReadFile(filepath.Join(home, filepath.FromSlash(file.Path)))
		if err != nil {
			return fmt.Errorf("the protocol bundle: %w", err)
		}
		sum := sha256.Sum256(actual)
		if hex.EncodeToString(sum[:]) != file.SHA256 {
			return fmt.Errorf("the protocol bundle's %s differs from its manifest", file.Path)
		}
	}
	digest, err := digestFiles(home, normative)
	if err != nil {
		return err
	}
	if digest != targetDigest {
		return fmt.Errorf("the protocol bundle's normative files digest to %s, not %s", digest, targetDigest)
	}
	for _, table := range []string{"tables/frames.json", "tables/serials.json", "tables/unicode.json"} {
		if _, ok := recorded["source/conformance/"+table]; !ok {
			return fmt.Errorf("the table %s is not a normative file of the bundle", table)
		}
	}
	return nil
}
