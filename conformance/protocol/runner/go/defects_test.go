package main

// Regression tests for the runner defects of #65.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// §4.1, §8.2: narrowing removes listen wherever Has would find it.
func TestWithoutListenLeavesBothLists(t *testing.T) {
	h := Hello{Driver: 1, Layers: []string{"seam", "peer", "listen"}, Features: []string{"listen", "lazy"}}
	n := h.without("listen")
	if n.Has("listen") || !n.Has("seam") || !n.Has("peer") || !n.Has("lazy") {
		t.Fatalf("without listen: %+v", n)
	}
	if !h.Has("listen") || len(h.Layers) != 3 || len(h.Features) != 2 {
		t.Errorf("narrowing changed the testee's hello: %+v", h)
	}
}

// §8.2 end to end: an implementation declared not to accept connections is
// never asked to listen, even when its hello names listen under layers.
func TestNotAcceptingIsNeverAskedToListen(t *testing.T) {
	hello := `{"id":ID,"ok":{"driver":1,"language":"x","layers":["seam","listen"],"features":["lazy"]}}`
	x, logX := probeImpl(t, "x", withHello(okConn, hello), no())
	y, logY := probeImpl(t, "y", okConn, nil)
	c := &Config{Scope: "core", Implementation: "x", Implementations: map[string]Implementation{"x": x, "y": y},
		Pairings: [][2]string{{"x", "y"}, {"y", "x"}}, Transports: []Transport{{Name: "t"}}, dir: t.TempDir()}
	ev := &Evidence{Scenarios: []Scenario{scen(t, "conns", "seam", false, `{"on":"runner","op":"pair.conns"}`)}}
	r, err := Execute(c, checkoutRoot(t), ev, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, op := range opsIn(t, logX) {
		if op == "conn.listen" || op == "peer.listen" {
			t.Fatalf("x was asked to %s", op)
		}
	}
	if n := strings.Count(strings.Join(opsIn(t, logY), " "), "conn.listen"); n != 2 || r.Claim.Result != "supported" {
		t.Errorf("y listened %d times; claim %+v", n, r.Claim)
	}
}

// §6.5, §5.5: foreach.as is a binding and may not be a keyword.
func TestLoadRefusesAKeywordForeach(t *testing.T) {
	for _, as := range []string{"any", "not", "regex"} {
		text := scenarioText(t, "seam", map[string]any{"foreach": map[string]any{"table": "tables/unicode.json", "as": as, "where": map[string]any{"name": "ASCII"}}})
		if _, err := Load(fakeCheckout(t, "seam", "x.json", text)); err == nil || !strings.Contains(err.Error(), "keyword") {
			t.Errorf("foreach as %s: %v", as, err)
		}
	}
}

// §5.1, §5.8, §9: a mirrored variant's name is a case name, and may not be
// another scenario's.
func TestLoadRefusesAMirroredNameTaken(t *testing.T) {
	for name, pair := range map[string][2]map[string]any{
		"plain":   {{"name": "x", "mirror": true}, {"name": "x (mirrored)"}},
		"per row": {{"name": "x", "mirror": true, "foreach": map[string]any{"table": "tables/unicode.json", "as": "row", "where": map[string]any{"name": "ASCII"}}}, {"name": "x[ASCII] (mirrored)"}},
	} {
		dir := fakeCheckout(t, "seam", "one.json", scenarioText(t, "seam", pair[0]))
		if err := os.WriteFile(filepath.Join(dir, filepath.FromSlash(contractDir), "scenarios", "seam", "two.json"), []byte(scenarioText(t, "seam", pair[1])), 0o644); err != nil {
			t.Fatal(err)
		}
		if _, err := Load(dir); err == nil || !strings.Contains(err.Error(), "also declared") {
			t.Errorf("%s: %v", name, err)
		}
	}
}

// §9: the same pairing twice, or two transports of one name, would give two
// cases one identity.
func TestReadConfigRefusesRepeats(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "run.json")
	base := `{"scope":"core","implementation":"x","implementations":{"x":{"name":"x","testee":{"argv":["x"]}}},"pairings":[["x","x"]],"transports":[{"name":"ws"}]}`
	for name, text := range map[string]string{
		"a repeated pairing":   strings.Replace(base, `[["x","x"]]`, `[["x","x"],["x","x"]]`, 1),
		"a repeated transport": strings.Replace(base, `[{"name":"ws"}]`, `[{"name":"ws"},{"name":"ws","env":{"A":"1"}}]`, 1),
		"an unnamed transport": strings.Replace(base, `[{"name":"ws"}]`, `[{}]`, 1),
	} {
		if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
			t.Fatal(err)
		}
		if _, err := ReadConfig(file); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
	if err := os.WriteFile(file, []byte(base), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := ReadConfig(file); err != nil {
		t.Errorf("the base: %v", err)
	}
}

// Fake implementations over the scripted fake testee.

func probeImpl(t *testing.T, name string, script map[string][]string, listen *bool) (Implementation, string) {
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
	return Implementation{
		Name: name, Listen: listen,
		Testee: Command{Argv: fakeCommand(self).Argv, Env: map[string]string{"RUNNER_FAKE_TESTEE": scriptFile, "RUNNER_FAKE_LOG": logFile}},
	}, logFile
}

func opsIn(t *testing.T, log string) []string {
	t.Helper()
	if _, err := os.Stat(log); err != nil {
		return nil
	}
	var out []string
	for _, r := range requests(t, log) {
		op := r["op"].(string)
		if op != "hello" && op != "reset" && op != "bye" {
			out = append(out, op)
		}
	}
	return out
}

func scen(t *testing.T, name, layer string, mirror bool, steps ...string) Scenario {
	t.Helper()
	s := Scenario{Name: name, Layer: layer, Scope: scopeOf[layer], Mirror: mirror, File: "scenarios/" + layer + "/probe.json", SHA256: strings.Repeat("0", 64)}
	for _, text := range steps {
		s.Steps = append(s.Steps, stepOf(t, text))
	}
	return s
}

var okConn = map[string][]string{
	"conn.listen": {`{"id":ID,"ok":{"handle":"l1","url":"ws://x"}}`},
	"conn.dial":   {`{"id":ID,"ok":{"handle":"c1"}}`},
	"conn.accept": {`{"id":ID,"ok":{"handle":"c2"}}`},
	"conn.send":   {`{"id":ID,"ok":{}}`},
	"peer.listen": {`{"id":ID,"ok":{"handle":"l1","url":"ws://x"}}`},
	"peer.dial":   {`{"id":ID,"ok":{"handle":"p1"}}`},
	"peer.accept": {`{"id":ID,"ok":{"handle":"p2"}}`},
}

func withHello(script map[string][]string, hello string) map[string][]string {
	out := map[string][]string{}
	for k, v := range script {
		out[k] = v
	}
	if hello != "" {
		out["hello"] = []string{hello}
	}
	return out
}
