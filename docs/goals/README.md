# Goals

## A small common boundary

A generator or consumer can describe the access it needs without depending on
the implementation of a peer, socket or tunnel. A runtime can provide that access
without depending on a generator or a consumer's model. Bitwire owns the shared
meaning at that boundary.

## Composition preserves access

Selecting an origin, mounting origins and forwarding access retain the same Wire
interface. Their laws hold independently of the physical carrier. Introducing a
wire boundary preserves the behavior of the model presented through it.

Wire composition and type composition are distinct obligations. A generic
adapter's construction must also preserve substitution, including arguments and
results that themselves expose models. That latter obligation belongs to the
generators and adapters; a matching Wire signature does not establish it.

## One meaning in every language

Language declarations and independent implementations answer to one written
contract and shared expected observations. Compiling the declarations is only
the first check. Conformance requires executing the observations.

## Explicit dependencies

Contract packages depend on neither Nightseam nor Bitlink, a transport, an
authentication system or the Bitsystem kernel. Implementations depend on the
contract, never the reverse: they live in bitruntime
([decision 0010](../decisions/0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md)), and using
Bitwire never requires Nightseam.
Higher layers supply their own type interpretations, scope machinery and
application policy. Public examples
and verification require no private checkout or organization secrets.
