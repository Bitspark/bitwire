# Exporting a Wire

**Status, 7 October 2026: proposed by [decision 0018](../decisions/0018-wire-export.md).**
This record specifies the [composition](composition.md#exporting-an-existing-wire)
target's first export protocol: live, connection-scoped export of a send-only Wire
over addressed reference routes, with explicit re-export through another hop. It
adds no method to Wire, Endpoint or AddressedWire and no field to the raw or
addressed formats. bitruntime realizes it; a consumer chooses where it is used.

## Terms

A **connection** joins two sides, each with an Endpoint. A side that opts in to
export on a connection declares an **export root**: a path in that connection's
addressed namespace. A composition chooses the root. No path is reserved by this
record.

The side keeps an **export table** for that connection. The table has a **scope**:
16 random octets, chosen when the side opts in, valid for that connection's
lifetime only. A new connection, even at the same place, has a new scope.

An **export** associates a send-only Wire, its **target**, with an **id**, an atom
issued by the table. Ids are never reused within a scope.

## The reference

A reference to an export is the ground value

```text
( "bitwire/ref/1", scope, id )
```

The header is the 13-octet ASCII atom `bitwire/ref/1`. Scope and id are atoms.
A reference is an ordinary Value. Raw carriers and addressed access never treat
it as a capability; only a binding that has opted in interprets it. It means "the
export `id` in the issuing side's table of scope `scope`" and nothing else.

## Routes

Relative to the exporting side's export root, the table answers two routes:

| Route | Message | Effect |
| --- | --- | --- |
| `["send", scope, id]` | any Value | Delivers the message to the export's target once. |
| `["release", scope, id]` | `()` | Removes the export. |

The side's connection dispatcher, its single receive owner (W4), hands every
addressed value under the export root to the table. The table then decides:

1. **Shape.** Anything other than `["send", s, i]` or `["release", s, i]` is
   refused `malformed-route`.
2. **Scope.** If `s` is not the table's scope, refuse `foreign-reference`.
3. **Send.** If `i` is a live export, send the message to its target once.
   Otherwise refuse `unknown-reference`.
4. **Release.** If `i` is a live export, remove it. Releasing a released or
   unknown id in the right scope changes nothing.

A refusal is observed by the exporting side's host only. It is never sent as a
message and is never an outcome of the target. The
[vectors](../../conformance/export-vectors.json) give the bytes and the cases.

## Import

A side that receives a reference over a connection imports it as:

```text
proxy   = Bind(Under(sender, peerRoot), ["send", scope, id])
release = Under(sender, peerRoot).send(["release", scope, id], ())
```

`sender` is that side's addressed sender on the connection, and `peerRoot` is the
peer's declared export root. Both are released mechanisms; import adds nothing to
Wire. The proxy grants `send` only: no receiving, no closing and no knowledge of
the target. A send through it is local admission on the connection (W5). It
proves neither delivery nor that the target ran.

A reference is meaningful only on the connection it arrived on. Copied onto
another connection, it carries a scope that no table there holds, so it is
refused `foreign-reference` there even if the ids happen to coincide.

## Lifetime

- **An export ends** when it is released, when its exporter withdraws it, or when
  its connection ends, since the scope ends with it.
- **Release removes only the forwarding association.** It never closes, releases
  or refuses the target, which may have other holders (W4).
- **Bounds.** A table has a bound. Exporting beyond it fails locally with
  `export-limit` and leaves existing exports unchanged.

## Re-export through another hop

A side that forwards traffic between connections may re-export an import:
1. Import a reference received on connection `In`.
2. Export that import's proxy on connection `Out`.
3. Send the new reference onward in place of the old one.

The re-export entry records its **source**: the import it depends on, and so
`In`'s scope.

- **Retirement.** When `In` ends, every re-export whose source came from `In`
  retires. Later sends to it are refused `unknown-reference`. A re-export never
  follows a replacement connection: the replacement has a new scope.
- **Dependent lifetime.** An import may have several dependents: re-exports on
  different connections, or holders on the forwarding side itself. Releasing one
  dependent never releases the import while another remains, and a send through a
  surviving branch still reaches the original target. When the last dependent is
  released, the forwarding side sends exactly one `release` for the import on `In`.
- **Placement.** Which references a forwarding side re-exports is the
  composition's declaration. A side never scans application payloads for
  reference-shaped values.

A reply crossing two forwarding boundaries is two re-exports. The caller exports
its reply Wire, each forwarding side re-exports what it imported, and the final
holder sends through its import. The value reaches the caller's Wire once per
delivered send, and each hop's admission is its own.

## Not in this record

- A duplex channel per Wire, and multiplexing.
- Exporting an Endpoint's receive or close ownership.
- Any use-once, reply-once or deadline rule. A consumer that wants one releases its
  export after the first send.
- Durable or restorable references, reconnection, and globally valid bearer
  references.
- Authentication of a sender. Holding a reference conveys send, never identity.

## Required observations

A realization reports each of these separately, in Go and TypeScript, on local
pairs and WebSocket connections:
1. The [encode vectors](../../conformance/export-vectors.json) and the rejected
   reference shapes.
2. Every delivery case against the declared table.
3. The listed observations, including:
   - the two-connection alias case;
   - scope renewal on a new connection;
   - fan-out with release of one branch;
   - retirement with the source;
   - bounds.
4. A reply across two forwarding boundaries between separate processes, in both
   language roles.
