package main

import (
	"testing"
	"unicode/utf8"
)

func TestReplaceInvalidUnicode(t *testing.T) {
	// The escapes are assembled from bs so that no escape in this file is
	// read as the character it names.
	bs := "\\"
	e := func(unit string) string { return bs + "u" + unit }
	q := func(s string) string { return `"` + s + `"` }
	for _, tc := range []struct{ name, in, want string }{
		{"a lone high surrogate", q(e("D800")), q(e("FFFD"))},
		{"a lone low surrogate", q(e("DC00") + "x"), q(e("FFFD") + "x")},
		{"a valid pair", q(e("D83D") + e("DE00")), q(e("D83D") + e("DE00"))},
		{"an escaped backslash before u", q(bs + bs + "uD800"), q(bs + bs + "uD800")},
		{"a high surrogate before a non-surrogate", q(e("D800") + e("0041")), q(e("FFFD") + e("0041"))},
		{"invalid UTF-8", q("a" + string([]byte{0xFF}) + "b"), q("a" + string(utf8.RuneError) + "b")},
		{"another escape", `{"x":` + q(e("00e9")) + `}`, `{"x":` + q(e("00e9")) + `}`},
	} {
		if got := string(replaceInvalidUnicode([]byte(tc.in))); got != tc.want {
			t.Errorf("%s: replaceInvalidUnicode(%s) = %s, want %s", tc.name, tc.in, got, tc.want)
		}
	}
}

func TestReplaceString(t *testing.T) {
	p := []byte(`{"params":{"method":"x"},"method" : "echo","id":"c:1"}`)
	got, ok := replaceString(p, "method", "echo", "4:echo")
	if !ok || string(got) != `{"params":{"method":"x"},"method" : "4:echo","id":"c:1"}` {
		t.Fatalf("%v %s", ok, got)
	}
	if _, ok := replaceString(p, "method", "absent", "y"); ok {
		t.Fatal("replaced a value that is not there")
	}
}
