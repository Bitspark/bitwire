// Command runner is bitwire's test-only runner for the bitwire/1
// conformance contract, edition 1 (conformance/protocol/CONTRACT.md). It
// loads the evidence set, drives two testees over driver 1, judges every
// answer and writes a report. It never speaks the protocol itself, and it
// is never published.
//
//	runner run -config run.json [-report report.json] [-only regexp]
//	runner digests    the contract, evidence and protocol digests, as JSON
//	runner load       the expanded cases of the evidence set, as JSON
//
// -checkout names the bitwire checkout; by default it is found above the
// working directory. Exit status: 0 when the claim is supported, 1 when it
// is not, 2 when the run could not be made.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	command, args := os.Args[1], os.Args[2:]
	flags := flag.NewFlagSet(command, flag.ExitOnError)
	checkout := flags.String("checkout", "", "the bitwire checkout (default: found above the working directory)")
	config := flags.String("config", "", "the run configuration (run)")
	reportFile := flags.String("report", "", "where to write the report (run; default stdout)")
	only := flags.String("only", "", "run only cases whose id matches this regular expression (run); the claim is then not supported")
	quiet := flags.Bool("quiet", false, "do not list each case on stderr (run)")
	_ = flags.Parse(args)
	root, err := findCheckout(*checkout)
	if err != nil {
		fail(err)
	}
	evidence, err := Load(root)
	if err != nil {
		fail(fmt.Errorf("the evidence set is refused: %w", err))
	}
	switch command {
	case "digests":
		write(os.Stdout, map[string]any{
			"edition":        edition,
			"contractDigest": evidence.ContractDigest,
			"evidenceDigest": evidence.EvidenceDigest,
			"protocol":       protocolIdentity{Revision: targetRevision, NormativeDigest: targetDigest},
		})
	case "load":
		type loaded struct {
			ID       string `json:"id"`
			File     string `json:"file"`
			Scope    string `json:"scope"`
			Optional string `json:"optional,omitempty"`
			Mirror   bool   `json:"mirror"`
			Steps    int    `json:"steps"`
		}
		out := []loaded{}
		for _, s := range evidence.Scenarios {
			out = append(out, loaded{ID: s.ID(), File: s.File, Scope: s.Scope, Optional: s.Optional, Mirror: s.Mirror, Steps: len(s.Steps)})
		}
		write(os.Stdout, out)
	case "run":
		if *config == "" {
			fail(fmt.Errorf("run needs -config"))
		}
		c, err := ReadConfig(*config)
		if err != nil {
			fail(err)
		}
		var filter *regexp.Regexp
		if *only != "" {
			if filter, err = regexp.Compile(*only); err != nil {
				fail(fmt.Errorf("-only: %w", err))
			}
		}
		log := os.Stderr
		if *quiet {
			log = nil
		}
		report, err := Execute(c, root, evidence, filter, log)
		if err != nil {
			fail(err)
		}
		out := os.Stdout
		if *reportFile != "" {
			if out, err = os.Create(*reportFile); err != nil {
				fail(err)
			}
		}
		write(out, report)
		if out != os.Stdout {
			if err := out.Close(); err != nil {
				fail(err)
			}
		}
		fmt.Fprintf(os.Stderr, "claim (%s, %s): %s; required: %d pass, %d fail, %d unsupported, %d skip, %d harness\n",
			report.Implementation.ID, report.Scope, report.Claim.Result,
			report.Claim.Counts[Pass], report.Claim.Counts[Fail], report.Claim.Counts[Unsupported], report.Claim.Counts[Skip], report.Claim.Counts[Harness])
		for _, limitation := range report.Claim.Limitations {
			fmt.Fprintf(os.Stderr, "  limitation: %s\n", limitation)
		}
		if report.Claim.Result != "supported" {
			os.Exit(1)
		}
	default:
		usage()
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: runner run -config run.json [-report file] [-only regexp] | runner digests | runner load  [-checkout dir]")
	os.Exit(2)
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "runner:", err)
	os.Exit(2)
}

func write(out *os.File, value any) {
	encoder := json.NewEncoder(out)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(value); err != nil {
		fail(err)
	}
}

// findCheckout is the given directory, or the nearest one above the working
// directory that holds the protocol bundle's manifest.
func findCheckout(given string) (string, error) {
	if given != "" {
		return filepath.Abs(given)
	}
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, filepath.FromSlash(bundleDir), "manifest.json")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("no bitwire checkout above the working directory; pass -checkout")
		}
		dir = parent
	}
}

// runnerIdentity is this runner's name, version and source revision, and
// whether the runner or the contract differ from that revision.
func runnerIdentity(checkout string) reportRunner {
	identity := reportRunner{Name: "bitwire conformance runner", Version: runnerVersion, Revision: "unknown"}
	git := func(args ...string) (string, error) {
		out, err := exec.Command("git", append([]string{"-C", checkout}, args...)...).Output()
		return strings.TrimSpace(string(out)), err
	}
	if revision, err := git("rev-parse", "HEAD"); err == nil {
		identity.Revision = revision
	}
	if status, err := git("status", "--porcelain", "--", contractDir); err == nil && status != "" {
		identity.Modified = true
	}
	return identity
}
