# Bitwire for Rust

A callable return capability holds Wire access to its own relative-path origin.
The selected profile defines supported paths, frame kinds and lifetime, and may
reserve that origin's paths for invocation operations. This grants no endpoint
receive or closure authority. Pure routing preserves the original return
capability and associated context; generic Wire alone does not imply lifecycle
support. Consumers must agree on a profile revision as well as its name; see
[the shared decision](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0004-return-origins-and-profile-revisions.md).

The relative-path `Wire` contract shared by runtimes, generated adapters and
applications. This crate owns the interface and supporting profile data; it
contains no executor, routing implementation, queue, codec or transport.

```toml
[dependencies]
bitwire = { package = "bitspark-bitwire", version = "0.2.0" }
```

The crate is named `bitspark-bitwire` on crates.io; the Rust library is `bitwire`.
Rust 1.85 or later is required. Runtime-independent means no dependency on
Nightseam or an async runtime. The `serde` and `serde_json` dependencies provide
public profile values and precision-preserving JSON payloads.

```rust
use bitwire::{Message, Payload, ProfileFrame, ProfileKind, PublicError, Wire};

fn notify(wire: &dyn Wire) -> Result<(), PublicError> {
    let mut frame = ProfileFrame::new(ProfileKind::Event);
    frame.data = Payload::from_json(r#"{"ready":true}"#).unwrap();
    wire.send(&["status".into()], Message::new(frame))
}
```

`Wire: Send + Sync` is object-safe, and `SharedWire` is `Arc<dyn Wire>`.
`Wire` exposes only `send`, returning admission errors synchronously without
awaiting replies or executing destination application code. `Endpoint: Wire`
adds `receive(receiver)` and `close(code, reason)` as endpoint-owner operations.
Only one receiver may be attached; duplicates are refused. `Receiver` supplies
thread-safe callbacks for every delivered relative path and complete message.
`Detach` is idempotent and cannot detach a replacement receiver. Path matching and
shared routing are separate compositions, not obligations of the access trait.

Paths are opaque Unicode-scalar segments, not delimited strings. `ReturnAddress`
uses `Arc` identity; message cloning and forwarding preserve that same allocation.
`Message::context` is optional opaque local data which a runtime interprets. Neither
capability nor context is serialized, and the whole message is not serializable.

`Payload::Absent` distinguishes an omitted member from `Payload::from_json("null")`.
Raw JSON spelling and numeric precision are retained. Converting with `value()`
uses `serde_json`'s arbitrary-precision number representation; it does not define
interoperability with another language's numeric types. The fixed profile version
is `PROFILE_VERSION`; a codec supplies and validates that encoded field.

`PublicError` is the Rust presentation of public profile error data and local
refusals. Its `unpublished` marker is a local provider assertion, not
self-authenticating proof. It is meaningful only when established by the
admitting runtime's own direct observation. Handler errors, received errors and
application-controlled markers do not establish non-publication. Serialization
omits it; handler, response and already-admitted forwarding boundaries must clear
it. Bitwire does not supply that runtime admission machinery.

See the [Wire contract](https://github.com/Bitspark/bitwire/blob/main/docs/wire/contract.md)
and [profile boundary](https://github.com/Bitspark/bitwire/blob/main/docs/wire/profile.md).
This binding is adapted from Nightseam's
[Rust contract](https://github.com/Bitspark/nightseam/blob/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f/duplex/rs/src/access.rs)
and [profile values](https://github.com/Bitspark/nightseam/blob/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f/duplex/rs/src/profile.rs).
The crate's [NOTICE](NOTICE) records attribution. Extraction does not itself mean
Nightseam has adopted this crate or that its complete runtime passes conformance.

## Checking the package

```sh
cargo test --locked --workspace --all-targets
cargo test --locked --workspace --doc
cargo run --locked -p bitspark-bitwire --example consumer
node wire/rs/check-package.mjs
```

The example exercises an application-facing trait object, local return identity,
opaque context and admission refusal without depending on a runtime. It is also
the clean-consumer fixture. `check-package.mjs` runs `cargo package`, extracts the
`.crate` outside the repository, creates a new package depending on that extracted
directory, and uses `examples/consumer.rs` as its `src/main.rs`. Running that
package verifies that the artifact is self-contained. It does not test routing
implementation. Use `--allow-dirty` only to check uncommitted local changes.
