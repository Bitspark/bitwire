//go:build tools

// Package testees pins bitruntime's released driver-1 testee for bitwire's
// bitwire/1 conformance runs. It is test-only and never published. The
// testee is built from this module with
//
//	go build -o bitwire-testee github.com/Bitspark/bitruntime/cmd/bitwire-testee/go
//
// This import keeps the requirement when the module is tidied.
package testees

import _ "github.com/Bitspark/bitruntime/core/go"
