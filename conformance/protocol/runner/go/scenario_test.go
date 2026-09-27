package main

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func checkoutRoot(t *testing.T) string {
	t.Helper()
	root, err := findCheckout("")
	if err != nil {
		t.Fatal(err)
	}
	return root
}

// The evidence set in this checkout loads, with the identities the node
// tooling computes (scripts/protocol-scenarios.mjs digests).
func TestLoadEvidence(t *testing.T) {
	evidence, err := Load(checkoutRoot(t))
	if err != nil {
		t.Fatal(err)
	}
	scenarios := map[string]bool{}
	var tables, mirrored int
	for _, s := range evidence.Scenarios {
		scenarios[s.File] = true
		if s.Row != nil {
			tables++
		}
		if s.Mirror {
			mirrored++
		}
		if s.Scope != scopeOf[s.Layer] {
			t.Errorf("%s: scope %s", s.ID(), s.Scope)
		}
	}
	var onDisk int
	_ = filepath.WalkDir(filepath.Join(checkoutRoot(t), filepath.FromSlash(contractDir), "scenarios"), func(_ string, entry fs.DirEntry, err error) error {
		if err == nil && !entry.IsDir() {
			onDisk++
		}
		return nil
	})
	if len(scenarios) != onDisk || onDisk < 37 {
		t.Errorf("%d scenario files loaded, %d on disk", len(scenarios), onDisk)
	}
	if tables == 0 || mirrored == 0 {
		t.Errorf("expected expanded tables (%d) and mirrored scenarios (%d)", tables, mirrored)
	}
	if len(evidence.ContractDigest) != 64 || len(evidence.EvidenceDigest) != 64 {
		t.Errorf("digests %q %q", evidence.ContractDigest, evidence.EvidenceDigest)
	}
}

// A fake checkout: the real protocol bundle and contract files, and one
// scenario of a test's making.
func fakeCheckout(t *testing.T, layer, name, scenario string) string {
	t.Helper()
	real, dir := checkoutRoot(t), t.TempDir()
	copyTree(t, filepath.Join(real, filepath.FromSlash(bundleDir)), filepath.Join(dir, filepath.FromSlash(bundleDir)))
	for _, file := range contractFiles {
		copyFile(t, filepath.Join(real, filepath.FromSlash(contractDir), file), filepath.Join(dir, filepath.FromSlash(contractDir), file))
	}
	target := filepath.Join(dir, filepath.FromSlash(contractDir), "scenarios", layer, name)
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte(scenario), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func copyTree(t *testing.T, from, to string) {
	t.Helper()
	err := filepath.WalkDir(from, func(p string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		relative, _ := filepath.Rel(from, p)
		copyFile(t, p, filepath.Join(to, relative))
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func copyFile(t *testing.T, from, to string) {
	t.Helper()
	data, err := os.ReadFile(from)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(to, data, 0o644); err != nil {
		t.Fatal(err)
	}
}

// scenarioText builds a scenario from a base, with members replaced.
func scenarioText(t *testing.T, layer string, replace map[string]any) string {
	t.Helper()
	s := map[string]any{
		"name":     "made by a test",
		"layer":    layer,
		"protocol": map[string]any{"revision": targetRevision, "normativeDigest": targetDigest},
		"scope":    scopeOf[layer],
		"needs":    []string{"seam"},
		"steps": []any{
			map[string]any{"on": "runner", "op": "pair.conns", "bind": map[string]any{"a": "ca", "b": "cb"}},
			map[string]any{"on": "a", "op": "conn.send", "args": map[string]any{"on": "$ca", "kind": "text", "text": "x"}},
		},
	}
	for k, v := range replace {
		if v == nil {
			delete(s, k)
		} else {
			s[k] = v
		}
	}
	data, err := json.Marshal(s)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func step(members map[string]any) map[string]any { return members }

// Each load check of §5.5 refuses the evidence set.
func TestLoadChecks(t *testing.T) {
	peerPair := step(map[string]any{"on": "runner", "op": "pair.peers", "args": map[string]any{"server": "a"}, "bind": map[string]any{"server": "ps", "client": "pc"}})
	cases := []struct {
		name, layer, file string
		replace           map[string]any
		refusal           string
	}{
		{"the base loads", "seam", "x.json", nil, ""},
		{"schema", "seam", "x.json", map[string]any{"mirror": "yes"}, "schema"},
		{"schema: unknown member", "seam", "x.json", map[string]any{"extra": 1}, "schema"},
		{"schema: bind name", "seam", "x.json", map[string]any{"steps": []any{step(map[string]any{"on": "a", "op": "conn.dial", "args": map[string]any{"url": "u"}, "bind": "Bad"})}}, "schema"},
		{"layer and directory", "peer", "x.json", map[string]any{"layer": "seam", "scope": "core"}, "lies under"},
		{"declared needs", "seam", "x.json", map[string]any{"needs": []string{"seam", "listen"}}, "declares needs"},
		{"protocol identity", "seam", "x.json", map[string]any{"protocol": map[string]any{"revision": "bitwire/1", "normativeDigest": strings.Repeat("0", 64)}}, "not the target"},
		{"runner op on a side", "seam", "x.json", map[string]any{"steps": []any{step(map[string]any{"on": "a", "op": "pair.conns"})}}, "written on runner"},
		{"testee op on runner", "seam", "x.json", map[string]any{"steps": []any{step(map[string]any{"on": "runner", "op": "conn.dial"})}}, "not an op of the runner"},
		{"server side", "peer", "x.json", map[string]any{"needs": []string{"peer"}, "steps": []any{step(map[string]any{"on": "runner", "op": "pair.peers", "args": map[string]any{"server": "c"}})}}, "names server"},
		{"role", "peer", "x.json", map[string]any{"needs": []string{"peer", "seam"}, "steps": []any{step(map[string]any{"on": "runner", "op": "pair.peer_and_conn", "args": map[string]any{"peer": "a", "role": "both"}})}}, "role"},
		{"runner bind by name", "seam", "x.json", map[string]any{"steps": []any{step(map[string]any{"on": "runner", "op": "pair.conns", "bind": "c"})}}, "binds by name"},
		{"runner expects nothing", "seam", "x.json", map[string]any{"steps": []any{step(map[string]any{"on": "runner", "op": "pair.conns", "expect": map[string]any{}})}}, "holds nothing"},
		{"observer repeat drains", "peer", "x.json", map[string]any{"optional": "observer", "needs": []string{"observer", "peer"}, "steps": []any{peerPair, step(map[string]any{"on": "a", "op": "peer.observed", "args": map[string]any{"on": "$ps"}, "repeat": map[string]any{"max": 3, "until": "match"}})}}, "drain"},
		{"foreach selects a row", "peer", "x.json", map[string]any{"needs": []string{"peer"}, "foreach": map[string]any{"table": "tables/frames.json", "as": "row", "where": map[string]any{"name": "no such row"}}, "steps": []any{peerPair}}, "selects no row"},
		{"scope follows the layer", "seam", "x.json", map[string]any{"scope": "tunnel"}, "has scope"},
		{"observer needs the marking", "peer", "x.json", map[string]any{"needs": []string{"observer", "peer"}, "optional": "defect", "steps": []any{peerPair, step(map[string]any{"on": "a", "op": "peer.observed", "args": map[string]any{"on": "$ps", "drain": false}})}}, "not marked optional observer"},
		{"observer in a required scenario", "peer", "x.json", map[string]any{"needs": []string{"observer", "peer"}, "steps": []any{peerPair, step(map[string]any{"on": "a", "op": "peer.observed", "args": map[string]any{"on": "$ps"}})}}, "required scenario"},
		{"observe option in a required scenario", "peer", "x.json", map[string]any{"needs": []string{"observer", "peer"}, "steps": []any{step(map[string]any{"on": "runner", "op": "pair.peers", "args": map[string]any{"server": "a", "server_options": map[string]any{"observe": true}}})}}, "required scenario"},
		{"excluded op", "peer", "x.json", map[string]any{"needs": []string{"peer"}, "steps": []any{peerPair, step(map[string]any{"on": "a", "op": "peer.identity", "args": map[string]any{"on": "$ps"}})}}, "excluded"},
		{"excluded behaviour", "peer", "x.json", map[string]any{"needs": []string{"peer"}, "steps": []any{peerPair, step(map[string]any{"on": "a", "op": "peer.handle", "args": map[string]any{"on": "$ps", "method": "m", "behavior": map[string]any{"kind": "through"}}})}}, "excluded"},
		{"repeat.max 2.0 is an integer", "seam", "x.json", map[string]any{"steps": []any{step(map[string]any{"on": "runner", "op": "pair.conns", "bind": map[string]any{"a": "ca"}}), step(map[string]any{"on": "a", "op": "conn.receive", "args": map[string]any{"on": "$ca"}, "repeat": map[string]any{"max": 2.0}})}}, ""},
		{"an argument named id", "seam", "x.json", map[string]any{"steps": []any{step(map[string]any{"on": "runner", "op": "pair.conns"}), step(map[string]any{"on": "a", "op": "conn.send", "args": map[string]any{"id": 1}})}}, "request's own member"},
		{"an argument named op", "seam", "x.json", map[string]any{"steps": []any{step(map[string]any{"on": "runner", "op": "pair.conns"}), step(map[string]any{"on": "a", "op": "conn.send", "args": map[string]any{"op": "x"}})}}, "request's own member"},
		{"bind names a keyword", "seam", "x.json", map[string]any{"steps": []any{step(map[string]any{"on": "runner", "op": "pair.conns", "bind": map[string]any{"a": "any"}})}}, "keyword"},
		{"$bind names a keyword", "seam", "x.json", map[string]any{"steps": []any{step(map[string]any{"on": "runner", "op": "pair.conns", "bind": map[string]any{"a": "ca"}}), step(map[string]any{"on": "a", "op": "conn.receive", "args": map[string]any{"on": "$ca"}, "expect": map[string]any{"text": "$bind:regex"}})}}, "keyword"},
		{"op family of the layer", "seam", "x.json", map[string]any{"needs": []string{"peer", "seam"}, "steps": []any{step(map[string]any{"on": "runner", "op": "pair.conns"}), step(map[string]any{"on": "a", "op": "peer.close", "args": map[string]any{"on": "x"}})}}, "does not belong"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := fakeCheckout(t, c.layer, c.file, scenarioText(t, c.layer, c.replace))
			_, err := Load(dir)
			switch {
			case c.refusal == "" && err != nil:
				t.Fatalf("refused: %v", err)
			case c.refusal != "" && err == nil:
				t.Fatalf("loaded; want a refusal naming %q", c.refusal)
			case c.refusal != "" && !strings.Contains(err.Error(), c.refusal):
				t.Fatalf("refused for another reason: %v", err)
			}
		})
	}
}

// Two scenarios that expand to one layer and name are refused.
func TestLoadRefusesDuplicateNames(t *testing.T) {
	text := scenarioText(t, "seam", nil)
	dir := fakeCheckout(t, "seam", "x.json", text)
	if err := os.WriteFile(filepath.Join(dir, filepath.FromSlash(contractDir), "scenarios", "seam", "y.json"), []byte(text), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(dir); err == nil || !strings.Contains(err.Error(), "also declared") {
		t.Fatalf("duplicate names: %v", err)
	}
}

// A bundle file that differs from the manifest refuses the evidence set.
func TestLoadVerifiesTheBundle(t *testing.T) {
	dir := fakeCheckout(t, "seam", "x.json", scenarioText(t, "seam", nil))
	table := filepath.Join(dir, filepath.FromSlash(tablesDir), "tables", "frames.json")
	data, err := os.ReadFile(table)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(table, append(data, ' '), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(dir); err == nil || !strings.Contains(err.Error(), "differs from its manifest") {
		t.Fatalf("a changed table: %v", err)
	}
}

// foreach: rows kept by where, a missing member comparing as null, named
// by the row's name or its index among the kept rows (§5.7).
func TestTableExpansion(t *testing.T) {
	root := checkoutRoot(t)
	all, err := tableRows(root, "tables/frames.json", map[string]any{})
	if err != nil || len(all) == 0 {
		t.Fatalf("rows: %d, %v", len(all), err)
	}
	var withName map[string]any
	for _, row := range all {
		if _, ok := row["name"].(string); ok {
			withName = row
			break
		}
	}
	if withName == nil {
		t.Skip("no named row to select")
	}
	kept, err := tableRows(root, "tables/frames.json", map[string]any{"name": withName["name"]})
	if err != nil || len(kept) != 1 {
		t.Fatalf("where name: %d rows, %v", len(kept), err)
	}
	missing, err := tableRows(root, "tables/frames.json", map[string]any{"no-such-member": nil})
	if err != nil || len(missing) != len(all) {
		t.Fatalf("a member no row has compares as null: %d of %d", len(missing), len(all))
	}
}

// §5.7: a kept row is named by its name when that is a string, and
// otherwise by its index among the kept rows.
func TestRowLabels(t *testing.T) {
	if got := rowLabel(map[string]any{"name": "ok frame"}, 3); got != "ok frame" {
		t.Errorf("a named row: %q", got)
	}
	if got := rowLabel(map[string]any{"name": 7}, 3); got != "3" {
		t.Errorf("a row whose name is not a string: %q", got)
	}
	if got := rowLabel(map[string]any{}, 0); got != "0" {
		t.Errorf("an unnamed row: %q", got)
	}
	evidence, err := Load(checkoutRoot(t))
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range evidence.Scenarios {
		if name, ok := s.Row["name"].(string); ok && !strings.HasSuffix(s.Name, "["+name+"]") {
			t.Errorf("%s is not named by its row %s", s.Name, name)
		}
	}
}

// The trace scenario asserts the response envelope structurally: an echoed
// request, or trace members nested inside result, do not hold (#65).
func TestTraceScenarioIsStructural(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(checkoutRoot(t), filepath.FromSlash(contractDir), "scenarios", "peer", "trace-members-any-order.json"))
	if err != nil {
		t.Fatal(err)
	}
	var file struct{ Steps []json.RawMessage }
	if err := json.Unmarshal(data, &file); err != nil {
		t.Fatal(err)
	}
	step := stepOf(t, string(file.Steps[3]))
	frame := func(object string) any { return map[string]any{"kind": "text", "text": object} }
	const tp = `"traceparent":"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"`
	const ts = `"tracestate":"congo=t61rcWkgMzE, rojo=00f067aa0ba902b7"`
	for text, holds := range map[string]bool{
		`{"version":1,"kind":"response","id":"c:1","result":{},` + tp + `,` + ts + `}`:                                             true,
		"{\n  " + ts + ",\n  \"version\": 1, \"id\": \"c:1\", \"kind\": \"response\", \"result\": {},\n  " + tp + "\n}":            true,
		`{"version":1,"kind":"request","id":"c:1","method":"4:echo","params":{},` + tp + `,` + ts + `}`:                            false,
		`{"version":1,"kind":"response","id":"c:1","result":{` + tp + `,` + ts + `}}`:                                              false,
		`{"version":1,"kind":"response","id":"c:1","result":{},` + tp + `,"tracestate":"congo=t61rcWkgMzE,rojo=00f067aa0ba902b7"}`: false,
	} {
		if err := match(step.Expect, frame(text), Bindings{}); (err == nil) != holds {
			t.Errorf("%s: holds %v, want %v (%v)", text, err == nil, holds, err)
		}
	}
}
