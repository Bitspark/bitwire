// Command mutant is a deliberately invalid bitwire/1 testee. It wraps a valid
// driver-1 testee, passes the runner's exchange through to it, and changes one
// thing: an argument the runner sends, an answer the testee gives, or a
// WebSocket frame the testee sends or receives. Every mutation makes the
// implementation behind it violate bitwire/1 in one stated way, and a
// conformance claim for it must not be supported.
//
// It is test-only and never published:
//
//	mutant -mutation name -- testee [args...]
//
// The mutation "none" changes nothing but still relays every WebSocket
// connection frame by frame. A claim for it must be supported, which shows
// that the proxy and its relay are transparent.
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
)

func main() {
	name := flag.String("mutation", "", "the mutation to apply (see -list)")
	list := flag.Bool("list", false, "list the mutations as JSON and exit")
	flag.Parse()
	if *list {
		type entry struct {
			Name     string   `json:"name"`
			Violates string   `json:"violates"`
			Catches  []string `json:"catches,omitempty"`
		}
		entries := []entry{}
		for n, m := range mutations {
			entries = append(entries, entry{n, m.violates, m.catches})
		}
		sort.Slice(entries, func(i, j int) bool { return entries[i].Name < entries[j].Name })
		os.Stdout.Write(append(encode(entries), '\n'))
		return
	}
	m, ok := mutations[*name]
	if !ok || flag.NArg() == 0 {
		fmt.Fprintln(os.Stderr, "usage: mutant -mutation name -- testee [args...]; mutant -list")
		os.Exit(2)
	}
	if err := run(m, flag.Args(), os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "mutant:", err)
		os.Exit(1)
	}
}

// run starts the testee and relays the exchange until the runner's stdin or
// the testee's stdout ends.
func run(m *mutation, argv []string, in io.Reader, out io.Writer) error {
	cmd := exec.Command(argv[0], argv[1:]...)
	cmd.Stderr = os.Stderr
	toTestee, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	fromTestee, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	p := &proxy{m: m}
	defer p.closeRelays()
	requests := bufio.NewReaderSize(in, 1<<20)
	answers := bufio.NewReaderSize(fromTestee, 1<<20)
	w := bufio.NewWriter(out)
	for {
		line, readErr := requests.ReadBytes('\n')
		if len(bytes.TrimSpace(line)) > 0 {
			answer, err := p.exchange(line, toTestee, answers)
			if err != nil {
				toTestee.Close()
				cmd.Wait()
				return err
			}
			w.Write(answer)
			w.WriteByte('\n')
			w.Flush()
		}
		if readErr != nil {
			toTestee.Close()
			return cmd.Wait()
		}
	}
}

type proxy struct {
	m      *mutation
	mu     sync.Mutex
	relays []*relay
}

// exchange passes one request to the testee and returns the answer the
// runner sees.
func (p *proxy) exchange(line []byte, toTestee io.Writer, answers *bufio.Reader) ([]byte, error) {
	req, err := decode(line)
	if err != nil {
		return nil, fmt.Errorf("a request is not a JSON object: %w", err)
	}
	op, _ := req["op"].(string)
	if op == "reset" || op == "bye" {
		p.closeRelays()
	}
	if p.m.request != nil {
		if reply := p.m.request(op, req); reply != nil {
			reply["id"] = req["id"]
			return encode(reply), nil
		}
	}
	if p.m.relay && (op == "conn.dial" || op == "peer.dial") {
		if url, ok := req["url"].(string); ok {
			r, err := p.startRelay(url, false)
			if err != nil {
				return nil, err
			}
			req["url"] = r.url
		}
	}
	if _, err := toTestee.Write(append(encode(req), '\n')); err != nil {
		return nil, err
	}
	answerLine, err := answers.ReadBytes('\n')
	if err != nil {
		return nil, fmt.Errorf("the testee ended: %w", err)
	}
	answerLine = bytes.TrimRight(answerLine, "\r\n")
	ans, err := decode(answerLine)
	if err != nil {
		return answerLine, nil // the runner judges what it cannot read
	}
	changed := false
	if ok, isOK := ans["ok"].(map[string]any); isOK {
		if p.m.relay && (op == "conn.listen" || op == "peer.listen") {
			if url, has := ok["url"].(string); has {
				r, err := p.startRelay(url, true)
				if err != nil {
					return nil, err
				}
				ok["url"] = r.url
				changed = true
			}
		}
		if p.m.answer != nil && p.m.answer(op, req, ok) {
			changed = true
		}
	}
	if !changed {
		return answerLine, nil
	}
	return encode(ans), nil
}

func (p *proxy) startRelay(url string, mutantListens bool) (*relay, error) {
	r, err := newRelay(url, mutantListens, p.m.frames)
	if err != nil {
		return nil, err
	}
	p.mu.Lock()
	p.relays = append(p.relays, r)
	p.mu.Unlock()
	return r, nil
}

func (p *proxy) closeRelays() {
	p.mu.Lock()
	relays := p.relays
	p.relays = nil
	p.mu.Unlock()
	for _, r := range relays {
		r.close()
	}
}

func decode(line []byte) (map[string]any, error) {
	d := json.NewDecoder(bytes.NewReader(line))
	d.UseNumber()
	var v map[string]any
	if err := d.Decode(&v); err != nil {
		return nil, err
	}
	if v == nil {
		return nil, fmt.Errorf("null")
	}
	return v, nil
}

func encode(v any) []byte {
	var b bytes.Buffer
	e := json.NewEncoder(&b)
	e.SetEscapeHTML(false)
	if err := e.Encode(v); err != nil {
		panic(err)
	}
	return bytes.TrimRight(b.Bytes(), "\n")
}

// optionsOf returns a request's options object, creating it when create is set.
func optionsOf(req map[string]any, create bool) map[string]any {
	o, _ := req["options"].(map[string]any)
	if o == nil && create {
		o = map[string]any{}
		req["options"] = o
	}
	return o
}

func hasPrefix(op string, prefixes ...string) bool {
	for _, p := range prefixes {
		if strings.HasPrefix(op, p) {
			return true
		}
	}
	return false
}
