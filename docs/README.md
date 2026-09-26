# Documentation

Bitwire specifies addressless Wire primitives, complete byte-keyed WireTree
structures and explicitly named AddressedWire carrier access. These pages
separate the shared boundary, executable checks and consumer adoption.

| Read this | To understand |
| --- | --- |
| [0.3 migration](migration-0.3.md) | Primitive, tree and addressed-carrier renames and preserved lifecycle obligations. |
| [Goals](goals/README.md) | What the contract is meant to make possible. |
| [Composition](composition.md) | Full tree composition, addressed access and their separate guarantees. |
| [Runnable examples](../examples/README.md) | Service trees, remounting, retained cart state and guards, cancellation and cross-language calls. |
| [Wire contract](wire/contract.md) | The surface, paths, receiver and composition laws. |
| [Message profile](wire/profile.md) | The existing Nightseam profile and the limits of interface compatibility. |
| [Carriers](wire/carriers.md) | Draft: transports and carriers, which ones the project provides, the carrier contract and the framed byte stream. |
| [Integration](integration.md) | Ownership, current dependencies and the next adoption steps. |
| [Language bindings](languages.md) | Eight-language scope, package coordinates and delivery status. |
| [First delivery](delivery.md) | The implementation lanes and the public Nightseam handover. |
| [Decisions](decisions/README.md) | Why the contract has an independent home. |
| [Conformance](../conformance/README.md) | Executed access observations and remaining obligations. |
| [Release policy](../RELEASING.md) | Candidate rehearsal, registry publication and verification. |

The [language matrix](languages.md) lists all eight native presentations.
The [changelog](../CHANGELOG.md) records delivery.
