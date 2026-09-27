package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// Values are decoded JSON with every number kept as spelled (json.Number),
// objects as map[string]any and arrays as []any. The contract's sections
// named below define what each function does; the citations there name the
// upstream code this was ported from.

// Bindings are what a case has bound so far, by name (CONTRACT.md §6.7).
type Bindings map[string]any

func (b Bindings) clone() Bindings {
	out := make(Bindings, len(b))
	for k, v := range b {
		out[k] = v
	}
	return out
}

// decode reads one JSON value, numbers kept as spelled. Invalid UTF-8 and
// unpaired surrogate escapes become U+FFFD (§3.3).
func decode(data []byte) (any, error) {
	var value any
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err := decoder.Decode(&value); err != nil {
		return nil, err
	}
	if !onlySpace(data[decoder.InputOffset():]) {
		return nil, fmt.Errorf("data follows the value")
	}
	return value, nil
}

// onlySpace reports whether data is nothing but JSON whitespace.
func onlySpace(data []byte) bool {
	for _, c := range data {
		if c != ' ' && c != '\t' && c != '\r' && c != '\n' {
			return false
		}
	}
	return true
}

// render writes a value the way Go writes it with encoding/json: no
// whitespace, members in byte order, numbers as spelled, and Go's string
// escaping (§7.3).
func render(value any) string {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprintf("%v", value)
	}
	return string(data)
}

// sameNumber holds two numbers equal by text, or as equal binary64 values
// (§6.2). A number binary64 cannot represent equals only its own text.
func sameNumber(a, b json.Number) bool {
	if a == b {
		return true
	}
	x, errX := a.Float64()
	y, errY := b.Float64()
	return errX == nil && errY == nil && x == y
}

// equal is value equality (§6.7): objects need the same member names.
func equal(a, b any) bool {
	switch x := a.(type) {
	case json.Number:
		y, ok := b.(json.Number)
		return ok && sameNumber(x, y)
	case map[string]any:
		y, ok := b.(map[string]any)
		if !ok || len(x) != len(y) {
			return false
		}
		for key, v := range x {
			w, ok := y[key]
			if !ok || !equal(v, w) {
				return false
			}
		}
		return true
	case []any:
		y, ok := b.([]any)
		if !ok || len(x) != len(y) {
			return false
		}
		for i := range x {
			if !equal(x[i], y[i]) {
				return false
			}
		}
		return true
	case string:
		y, ok := b.(string)
		return ok && x == y
	case bool:
		y, ok := b.(bool)
		return ok && x == y
	case nil:
		return b == nil
	}
	return false
}

// match holds actual to an expectation under the bindings, binding as it
// goes, and says where they parted (§6).
func match(expected, actual any, b Bindings) error {
	return matchAt("", expected, actual, b)
}

func matchAt(path string, expected, actual any, b Bindings) error {
	switch e := expected.(type) {
	case string:
		if strings.HasPrefix(e, "$") {
			return matchPlaceholder(path, e, actual, b)
		}
		s, ok := actual.(string)
		if !ok || s != e {
			return fmt.Errorf("%s: expected %s, got %s", at(path), render(e), render(actual))
		}
		return nil
	case map[string]any:
		if contains, ok := e["$contains"]; ok {
			return matchContains(path, contains, e["$sequence_by"], actual, b)
		}
		object, ok := actual.(map[string]any)
		if !ok {
			return fmt.Errorf("%s: expected an object, got %s", at(path), render(actual))
		}
		keys := make([]string, 0, len(e))
		for key := range e {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			want := e[key]
			got, present := object[key]
			if want == "$absent" {
				if present {
					return fmt.Errorf("%s: expected no %s, got %s", at(path), key, render(got))
				}
				continue
			}
			if !present {
				return fmt.Errorf("%s: expected %s, which is absent", at(path), key)
			}
			if err := matchAt(path+"."+key, want, got, b); err != nil {
				return err
			}
		}
		return nil
	case []any:
		list, ok := actual.([]any)
		if !ok {
			return fmt.Errorf("%s: expected an array, got %s", at(path), render(actual))
		}
		if len(list) != len(e) {
			return fmt.Errorf("%s: expected %d elements, got %d: %s", at(path), len(e), len(list), render(actual))
		}
		for i := range e {
			if err := matchAt(fmt.Sprintf("%s[%d]", path, i), e[i], list[i], b); err != nil {
				return err
			}
		}
		return nil
	case nil:
		if actual != nil {
			return fmt.Errorf("%s: expected null, got %s", at(path), render(actual))
		}
		return nil
	case bool:
		v, ok := actual.(bool)
		if !ok || v != e {
			return fmt.Errorf("%s: expected %v, got %s", at(path), e, render(actual))
		}
		return nil
	case json.Number:
		v, ok := actual.(json.Number)
		if !ok || !sameNumber(e, v) {
			return fmt.Errorf("%s: expected %s, got %s", at(path), e, render(actual))
		}
		return nil
	}
	return fmt.Errorf("%s: an expectation of %T is not JSON", at(path), expected)
}

// keywords take precedence over a binding of the same name (§6.5).
var keywords = map[string]bool{
	"any": true, "string": true, "int": true, "number": true, "odd": true, "even": true,
	"bool": true, "absent": true, "bind": true, "not": true, "regex": true,
}

func matchPlaceholder(path, placeholder string, actual any, b Bindings) error {
	name, argument, _ := strings.Cut(placeholder[1:], ":")
	switch name {
	case "any":
		return nil
	case "absent":
		return fmt.Errorf("%s: $absent stands only as an object member's expectation", at(path))
	case "string":
		if _, ok := actual.(string); !ok {
			return fmt.Errorf("%s: expected a string, got %s", at(path), render(actual))
		}
	case "int":
		n, ok := actual.(json.Number)
		if !ok {
			return fmt.Errorf("%s: expected an integer, got %s", at(path), render(actual))
		}
		if _, err := n.Int64(); err != nil {
			return fmt.Errorf("%s: expected an integer, got %s", at(path), n)
		}
	case "number":
		if _, ok := actual.(json.Number); !ok {
			return fmt.Errorf("%s: expected a number, got %s", at(path), render(actual))
		}
	case "odd", "even":
		n, ok := actual.(json.Number)
		if !ok {
			return fmt.Errorf("%s: expected an integer, got %s", at(path), render(actual))
		}
		i, err := n.Int64()
		if err != nil {
			return fmt.Errorf("%s: expected an integer, got %s", at(path), n)
		}
		if (i%2 != 0) != (name == "odd") {
			return fmt.Errorf("%s: expected an %s integer, got %d", at(path), name, i)
		}
	case "bool":
		if _, ok := actual.(bool); !ok {
			return fmt.Errorf("%s: expected a boolean, got %s", at(path), render(actual))
		}
	case "bind":
		if argument == "" {
			return fmt.Errorf("%s: $bind names nothing", at(path))
		}
		b[argument] = actual
	case "not":
		bound, ok := b[argument]
		if !ok {
			return fmt.Errorf("%s: $not:%s refers to nothing bound", at(path), argument)
		}
		if equal(bound, actual) {
			return fmt.Errorf("%s: expected anything but %s", at(path), render(bound))
		}
	case "regex":
		s, ok := actual.(string)
		if !ok {
			return fmt.Errorf("%s: expected a string matching %s, got %s", at(path), argument, render(actual))
		}
		pattern, err := regexp.Compile(argument)
		if err != nil {
			return fmt.Errorf("%s: $regex:%s: %v", at(path), argument, err)
		}
		if !pattern.MatchString(s) {
			return fmt.Errorf("%s: expected a string matching %s, got %s", at(path), argument, render(s))
		}
	default:
		bound, ok := resolve(placeholder[1:], b)
		if !ok {
			return fmt.Errorf("%s: %s refers to nothing bound", at(path), placeholder)
		}
		if !equal(bound, actual) {
			return fmt.Errorf("%s: expected %s (bound as %s), got %s", at(path), render(bound), placeholder, render(actual))
		}
	}
	return nil
}

// matchContains holds an ordered subsequence, per lane when sequenceBy
// names one (§6.6). The search is greedy and never backtracks.
func matchContains(path string, contains, sequenceBy, actual any, b Bindings) error {
	wanted, ok := contains.([]any)
	if !ok {
		return fmt.Errorf("%s: $contains takes an array", at(path))
	}
	list, ok := actual.([]any)
	if !ok {
		return fmt.Errorf("%s: expected an array, got %s", at(path), render(actual))
	}
	key, _ := sequenceBy.(string)
	cursor := map[string]int{}
	for i, want := range wanted {
		lane := ""
		if key != "" {
			if object, ok := want.(map[string]any); ok {
				if v, ok := object[key]; ok {
					lane = render(v)
				}
			}
		}
		found := false
		for j := cursor[lane]; j < len(list); j++ {
			if lane != "" {
				object, ok := list[j].(map[string]any)
				if !ok || render(object[key]) != lane {
					continue
				}
			}
			if matchAt(fmt.Sprintf("%s[%d]", path, j), want, list[j], b) == nil {
				cursor[lane] = j + 1
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("%s: element %d of $contains, %s, is not found in order in %s", at(path), i, render(want), render(actual))
		}
	}
	return nil
}

// resolve looks a path n.m1.m2 up in the bindings, through objects only.
func resolve(name string, b Bindings) (any, bool) {
	head, rest, nested := strings.Cut(name, ".")
	value, ok := b[head]
	if !ok {
		return nil, false
	}
	for nested {
		object, ok := value.(map[string]any)
		if !ok {
			return nil, false
		}
		head, rest, nested = strings.Cut(rest, ".")
		if value, ok = object[head]; !ok {
			return nil, false
		}
	}
	return value, true
}

// substitute replaces every whole-string placeholder in a step's arguments
// (§5.6). "$$" escapes a literal "$"; there are no matchers in arguments.
func substitute(value any, b Bindings) (any, error) {
	switch v := value.(type) {
	case string:
		if !strings.HasPrefix(v, "$") {
			return v, nil
		}
		if strings.HasPrefix(v, "$$") {
			return v[1:], nil
		}
		bound, ok := resolve(v[1:], b)
		if !ok {
			return nil, fmt.Errorf("%s refers to nothing bound", v)
		}
		return bound, nil
	case map[string]any:
		out := make(map[string]any, len(v))
		for key, member := range v {
			replaced, err := substitute(member, b)
			if err != nil {
				return nil, err
			}
			out[key] = replaced
		}
		return out, nil
	case []any:
		out := make([]any, len(v))
		for i, member := range v {
			replaced, err := substitute(member, b)
			if err != nil {
				return nil, err
			}
			out[i] = replaced
		}
		return out, nil
	}
	return value, nil
}

func at(path string) string {
	if path == "" {
		return "the answer"
	}
	return "the answer" + path
}
