package main

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// A scenario opens its connections with the runner's own ops, written
// "on": "runner", and the runner expands each into testee ops from what the
// two sides answered hello with (CONTRACT.md §4.1).

// needsOf is what a step asks of the side that runs it (§5.4). A runner
// step asks what its expansion will, less listen and lazy, which are the
// runner's choice and which the expanded steps declare for themselves.
func needsOf(step Step) map[string][]string {
	needs := map[string][]string{}
	add := func(side, need string) { needs[side] = append(needs[side], need) }
	family, _, _ := strings.Cut(step.Op, ".")
	if family == "pair" {
		switch step.Op {
		case "pair.conns":
			add("a", "seam")
			add("b", "seam")
		case "pair.peers":
			add("a", "peer")
			add("b", "peer")
			server, _ := step.Args["server"].(string)
			addOptionNeeds(add, server, step.Args["server_options"])
			addOptionNeeds(add, other(server), step.Args["client_options"])
		case "pair.peer_and_conn":
			peer, _ := step.Args["peer"].(string)
			add(peer, "peer")
			add(other(peer), "seam")
			addOptionNeeds(add, peer, step.Args["options"])
		}
		return needs
	}
	side := step.On
	switch family {
	case "conn":
		add(side, "seam")
	case "peer", "call":
		add(side, "peer")
	case "tunnel":
		add(side, "tunnel")
	}
	switch step.Op {
	case "conn.listen", "peer.listen":
		add(side, "listen")
	case "conn.pipe":
		add(side, "pipe")
	case "peer.observed":
		add(side, "observer")
	}
	if consume, _ := step.Args["consume"].(string); consume == "lazy" {
		add(side, "lazy")
	}
	addOptionNeeds(add, side, step.Args["options"])
	return needs
}

func addOptionNeeds(add func(side, need string), side string, options any) {
	object, _ := options.(map[string]any)
	if object == nil {
		return
	}
	if on, _ := object["propagate"].(bool); on {
		add(side, "propagator")
	}
	if on, _ := object["observe"].(bool); on {
		add(side, "observer")
	}
}

func other(side string) string {
	if side == "a" {
		return "b"
	}
	return "a"
}

// sideNeeds is each side's needs over the steps, sorted and without repeats.
func sideNeeds(steps []Step) map[string][]string {
	out := map[string][]string{}
	for _, step := range steps {
		for side, needs := range needsOf(step) {
			out[side] = append(out[side], needs...)
		}
	}
	for side, needs := range out {
		out[side] = sortedSet(needs)
	}
	return out
}

func sortedSet(values []string) []string {
	sort.Strings(values)
	out := values[:0]
	for i, v := range values {
		if i == 0 || v != values[i-1] {
			out = append(out, v)
		}
	}
	return out
}

// holdDeclared holds a scenario's declared needs to the union of what its
// steps ask of both sides, before expansion (§5.4).
func holdDeclared(s Scenario) error {
	var derived []string
	for _, needs := range sideNeeds(s.Steps) {
		derived = append(derived, needs...)
	}
	derived = sortedSet(derived)
	declared := sortedSet(append([]string(nil), s.Needs...))
	if strings.Join(declared, " ") == strings.Join(derived, " ") {
		return nil
	}
	return fmt.Errorf("declares needs [%s] but its steps ask for [%s]", strings.Join(declared, ", "), strings.Join(derived, ", "))
}

// checkRunnerStep holds a runner step to its shape (§5.5).
func checkRunnerStep(step Step) error {
	if step.On != "runner" {
		if strings.HasPrefix(step.Op, "pair.") {
			return fmt.Errorf("%s is the runner's op and is written on runner", step.Op)
		}
		return nil
	}
	sideArg := func(name string) error {
		v, ok := step.Args[name].(string)
		if !ok || (v != "a" && v != "b") {
			return fmt.Errorf("%s names %s, a or b", step.Op, name)
		}
		return nil
	}
	if step.Bind != nil {
		if _, ok := step.Bind.(map[string]any); !ok {
			return fmt.Errorf("%s binds by name: an object", step.Op)
		}
	}
	switch step.Op {
	case "pair.conns":
	case "pair.peers":
		if err := sideArg("server"); err != nil {
			return err
		}
	case "pair.peer_and_conn":
		if err := sideArg("peer"); err != nil {
			return err
		}
		if role, _ := step.Args["role"].(string); role != "client" && role != "server" {
			return fmt.Errorf("%s names a role, client or server", step.Op)
		}
	default:
		return fmt.Errorf("%s is not an op of the runner", step.Op)
	}
	if step.HasExpect || step.ExpectError != nil || step.Assert != nil || step.Repeat != nil {
		return fmt.Errorf("%s holds nothing of its own", step.Op)
	}
	return nil
}

// mirrorRunnerStep exchanges the sides a runner step names (§5.8).
func mirrorRunnerStep(step Step) Step {
	m := step
	m.Args = map[string]any{}
	for key, value := range step.Args {
		switch {
		case key == "server" || key == "peer":
			m.Args[key] = other(value.(string))
		case strings.HasSuffix(key, "_a"):
			m.Args[strings.TrimSuffix(key, "_a")+"_b"] = value
		case strings.HasSuffix(key, "_b"):
			m.Args[strings.TrimSuffix(key, "_b")+"_a"] = value
		default:
			m.Args[key] = value
		}
	}
	if binds, ok := step.Bind.(map[string]any); ok && step.Op == "pair.conns" {
		flipped := map[string]any{}
		for key, value := range binds {
			flipped[other(key)] = value
		}
		m.Bind = flipped
	}
	return m
}

// expand replaces every runner step by testee ops, given each side's hello,
// or says why the pairing cannot be arranged, which ends the case
// unsupported (§7.1).
func expand(steps []Step, hello map[string]Hello) ([]Step, string) {
	var out []Step
	n := 0
	for i, step := range steps {
		if step.On != "runner" {
			step.source, step.part = i, -1
			out = append(out, step)
			continue
		}
		n++
		expanded, unsupported := expandPair(step, hello, fmt.Sprintf("_p%d", n))
		if unsupported != "" {
			return nil, unsupported
		}
		for k := range expanded {
			expanded[k].source, expanded[k].part = i, k
		}
		out = append(out, expanded...)
	}
	return out, ""
}

func expandPair(step Step, hello map[string]Hello, prefix string) ([]Step, string) {
	can := func(side, feature string) bool { return hello[side].Has(feature) }
	bindOf := func(key string) any {
		binds, _ := step.Bind.(map[string]any)
		if name, ok := binds[key].(string); ok {
			return name
		}
		return nil
	}
	arg := func(name string) any { return step.Args[name] }
	// Runner-op arguments are read before substitution: limit only as a
	// number, consume only as a nonempty string (§4.1).
	number := func(v any) (json.Number, bool) {
		n, ok := v.(json.Number)
		return n, ok
	}
	listened := map[string]any{"handle": prefix + "_l", "url": prefix + "_url"}
	rawPair := func(listener string, limitL, limitD, consumeL, consumeD any) (steps []Step, accepted, dialed string) {
		dialer := other(listener)
		accepted, dialed = prefix+"_c"+listener, prefix+"_c"+dialer
		listenArgs := map[string]any{}
		if n, ok := number(limitL); ok {
			listenArgs["limit"] = n
		}
		dialArgs := map[string]any{"url": "$" + prefix + "_url"}
		if n, ok := number(limitD); ok {
			dialArgs["limit"] = n
		}
		if c, ok := consumeD.(string); ok && c != "" {
			dialArgs["consume"] = c
		}
		acceptArgs := map[string]any{"on": "$" + prefix + "_l"}
		if c, ok := consumeL.(string); ok && c != "" {
			acceptArgs["consume"] = c
		}
		return []Step{
			{On: listener, Op: "conn.listen", Args: listenArgs, Bind: listened},
			{On: dialer, Op: "conn.dial", Args: dialArgs, Bind: dialed},
			{On: listener, Op: "conn.accept", Args: acceptArgs, Bind: accepted},
		}, accepted, dialed
	}
	over := func(side, conn, role string, options any, bind any) Step {
		args := map[string]any{"on": "$" + conn, "role": role}
		if options != nil {
			args["options"] = options
		}
		return Step{On: side, Op: "peer.over", Args: args, Bind: bind}
	}
	limitOf := func(options any) any {
		object, _ := options.(map[string]any)
		if object == nil {
			return nil
		}
		return object["max_frame_bytes"]
	}
	switch step.Op {
	case "pair.conns":
		listener := ""
		for _, side := range []string{"a", "b"} {
			if can(side, "listen") {
				listener = side
				break
			}
		}
		if listener == "" {
			return nil, "neither testee can listen"
		}
		dialer := other(listener)
		steps, accepted, dialed := rawPair(listener, arg("limit_"+listener), arg("limit_"+dialer), arg("consume_"+listener), arg("consume_"+dialer))
		steps[2].Bind = nameOr(bindOf(listener), accepted)
		steps[1].Bind = nameOr(bindOf(dialer), dialed)
		return steps, ""
	case "pair.peers":
		server, _ := arg("server").(string)
		client := other(server)
		serverOptions, clientOptions := arg("server_options"), arg("client_options")
		if can(server, "listen") {
			listenArgs := map[string]any{}
			if serverOptions != nil {
				listenArgs["options"] = serverOptions
			}
			dialArgs := map[string]any{"url": "$" + prefix + "_url"}
			if clientOptions != nil {
				dialArgs["options"] = clientOptions
			}
			return []Step{
				{On: server, Op: "peer.listen", Args: listenArgs, Bind: listened},
				{On: client, Op: "peer.dial", Args: dialArgs, Bind: nameOr(bindOf("client"), prefix+"_pc")},
				{On: server, Op: "peer.accept", Args: map[string]any{"on": "$" + prefix + "_l"}, Bind: nameOr(bindOf("server"), prefix+"_ps")},
			}, ""
		}
		if !can(client, "listen") {
			return nil, "neither testee can listen"
		}
		if !can(server, "lazy") || !can(client, "lazy") {
			return nil, fmt.Sprintf("side %s cannot listen, and peers over a connection side %s accepted need lazy consumption on both", server, client)
		}
		steps, accepted, dialed := rawPair(client, limitOf(clientOptions), limitOf(serverOptions), "lazy", "lazy")
		steps = append(steps,
			over(client, accepted, "client", clientOptions, nameOr(bindOf("client"), prefix+"_pc")),
			over(server, dialed, "server", serverOptions, nameOr(bindOf("server"), prefix+"_ps")),
		)
		return steps, ""
	case "pair.peer_and_conn":
		peer, _ := arg("peer").(string)
		raw := other(peer)
		role, _ := arg("role").(string)
		options := arg("options")
		if can(peer, "listen") {
			if role == "server" {
				listenArgs := map[string]any{}
				if options != nil {
					listenArgs["options"] = options
				}
				dialArgs := map[string]any{"url": "$" + prefix + "_url"}
				if n, ok := number(arg("limit")); ok {
					dialArgs["limit"] = n
				}
				if c, ok := arg("consume").(string); ok && c != "" {
					dialArgs["consume"] = c
				}
				return []Step{
					{On: peer, Op: "peer.listen", Args: listenArgs, Bind: listened},
					{On: raw, Op: "conn.dial", Args: dialArgs, Bind: nameOr(bindOf("conn"), prefix+"_c")},
					{On: peer, Op: "peer.accept", Args: map[string]any{"on": "$" + prefix + "_l"}, Bind: nameOr(bindOf("peer"), prefix+"_p")},
				}, ""
			}
			if !can(peer, "lazy") {
				return nil, fmt.Sprintf("side %s takes a client peer over a connection it accepted, which needs lazy consumption", peer)
			}
			steps, accepted, dialed := rawPair(peer, limitOf(options), arg("limit"), "lazy", arg("consume"))
			steps[1].Bind = nameOr(bindOf("conn"), dialed)
			steps = append(steps, over(peer, accepted, role, options, nameOr(bindOf("peer"), prefix+"_p")))
			return steps, ""
		}
		if !can(raw, "listen") {
			return nil, "neither testee can listen"
		}
		if !can(peer, "lazy") {
			return nil, fmt.Sprintf("side %s cannot listen, and a peer over a connection it dialed needs lazy consumption", peer)
		}
		steps, accepted, dialed := rawPair(raw, arg("limit"), limitOf(options), arg("consume"), "lazy")
		steps[2].Bind = nameOr(bindOf("conn"), accepted)
		steps = append(steps, over(peer, dialed, role, options, nameOr(bindOf("peer"), prefix+"_p")))
		return steps, ""
	}
	return nil, "not a runner op: " + step.Op
}

// nameOr is the scenario's name for a handle, or the runner's own.
func nameOr(name any, internal string) any {
	if name != nil {
		return name
	}
	return internal
}
