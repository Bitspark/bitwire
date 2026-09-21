"""The shared relative-path Wire contract, without a runtime dependency.

Adapted from Nightseam's duplex/py/nightseam/duplex/wire.py at
1c63f1c4d7e4b5987d4bd32e294177645c92ed8f under Apache-2.0.
Dispatch, path encoding, carriers and composition helpers belong to implementations.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Literal, NotRequired, Protocol, TypedDict, runtime_checkable

__all__ = [
    "Path",
    "ProfileKind",
    "ProfileError",
    "RequestFrame",
    "ResultFrame",
    "ErrorFrame",
    "EventFrame",
    "CancelFrame",
    "ProfileFrame",
    "ReturnAddress",
    "Message",
    "Receiver",
    "Wire",
]

# Opaque Unicode-scalar segments: [] != [""] != ["a/b"] != ["a", "b"].
Path = Sequence[str]
ProfileKind = Literal["request", "response", "event", "cancel"]


class ProfileError(TypedDict):
    """Public error data, independent of any runtime exception class."""

    code: str
    message: str
    data: NotRequired[object]


class _TracedFrame(TypedDict):
    version: Literal[1]
    traceparent: NotRequired[str]
    tracestate: NotRequired[str]


class RequestFrame(_TracedFrame):
    """The send path supplies the method name; params follow the JSON profile."""

    kind: Literal["request"]
    id: str
    params: object
    meta: NotRequired[Mapping[str, str]]


class ResultFrame(_TracedFrame):
    kind: Literal["response"]
    id: str
    result: object


class ErrorFrame(_TracedFrame):
    kind: Literal["response"]
    id: str
    error: ProfileError


class EventFrame(_TracedFrame):
    """The send path supplies the event name; data follow the JSON profile."""

    kind: Literal["event"]
    data: object
    meta: NotRequired[Mapping[str, str]]


class CancelFrame(_TracedFrame):
    kind: Literal["cancel"]
    id: str


ProfileFrame = RequestFrame | ResultFrame | ErrorFrame | EventFrame | CancelFrame


@dataclass(frozen=True, eq=False)
class ReturnAddress:
    """Local capability with identity equality, never a network-envelope member.

    Different addresses stay distinct even when they hold the same Wire. The
    wrapped implementation need not support equality or hashing. Routing must
    preserve this address object, rather than construct an equivalent wrapper.
    Runtime-owned received context associated with this identity must survive
    routing; application payloads are not evidence of verified context.
    """

    wire: Wire


@dataclass(frozen=True)
class Message:
    """A profile frame plus optional local return access.

    Only frame data belongs to the serialized profile. Payloads typed as object
    must still satisfy the JSON profile; arbitrary Python objects are not implied.
    """

    frame: ProfileFrame
    return_address: ReturnAddress | None = None


@dataclass(frozen=True)
class Receiver:
    """Callbacks receive paths relative to the Wire on which they registered.

    Exact routes win, then the longest namespace segment prefix wins. A receiver
    may be synchronous or awaitable; endpoint implementations own dispatch.
    """

    namespace: bool = False
    message: Callable[[Path, Message], None | Awaitable[None]] | None = None
    closed: Callable[[int, str], None] | None = None


@runtime_checkable
class Wire(Protocol):
    """Access to an origin with synchronous admission and asynchronous dispatch.

    send returns on acceptance or raises on refusal, without running destination
    application code on the sender's stack. receive refuses duplicate paths and
    returns an idempotent detach. A root owns dispatch, bounds and closure; a
    selected view shares that closure, while a mount owns only its registrations
    and routing. Structural protocol matching alone does not prove these laws.
    """

    def send(self, path: Path, message: Message) -> None: ...

    def receive(self, path: Path, receiver: Receiver) -> Callable[[], None]: ...

    def close(self, code: int = 1000, reason: str = "") -> None: ...
