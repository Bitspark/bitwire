# Security

## Reporting

Report vulnerabilities privately to **security@bitspark.dev**, the reporting
address used by Bitspark's Archon project. Include the affected commit, the
contract or package involved and a minimal reproduction. Do not disclose a
vulnerability in an issue or pull request.

After public vulnerability reporting is enabled, GitHub's **Security → Report a
vulnerability** will provide another private channel.

## Scope

The shared contract and its language presentations must preserve agreed routing,
return-access, lifetime and context guarantees. A defect that permits these
guarantees to be interpreted incompatibly is relevant here. Runtime-specific
implementation defects should also be reported to the implementation's maintainers.

The scaffold contains declarations and development checks, with no endpoint
runtime or released packages. Fixes currently target `main`; supported release
lines will be documented when the first release is made.
