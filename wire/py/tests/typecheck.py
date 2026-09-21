"""Compile-only consumers, including rejections guarded by unused-ignore checks."""

from typing import assert_type

from bitwire import (
    CancelFrame,
    ErrorFrame,
    EventFrame,
    Message,
    Path,
    ProfileFrame,
    ProfileKind,
    Receiver,
    RequestFrame,
    ResultFrame,
    ReturnAddress,
    Wire,
)


def consume(wire: Wire, frame: ProfileFrame) -> None:
    address = ReturnAddress(wire)
    wire.send(["scope", ""], Message(frame, address))
    assert_type(address.wire, Wire)
    kind: ProfileKind = frame["kind"]
    assert_type(kind, ProfileKind)
    if frame["kind"] == "request":
        assert_type(frame["id"], str)

    async def delivered(path: Path, message: Message) -> None:
        assert_type(message.return_address, ReturnAddress | None)

    wire.receive([], Receiver(namespace=True, message=delivered))()
    wire.send([42], Message(frame))  # type: ignore[list-item]


request: RequestFrame = {"version": 1, "kind": "request", "id": "1", "params": {}}
result: ResultFrame = {"version": 1, "kind": "response", "id": "1", "result": None}
error: ErrorFrame = {"version": 1, "kind": "response", "id": "1", "error": {"code": "no", "message": "No"}}
event: EventFrame = {"version": 1, "kind": "event", "data": None}
cancel: CancelFrame = {"version": 1, "kind": "cancel", "id": "1"}
invalid_version: RequestFrame = {"version": 2, "kind": "request", "id": "1", "params": {}}  # type: ignore[typeddict-item]
contradictory: ResultFrame = {"version": 1, "kind": "response", "id": "1", "result": None, "error": {"code": "x", "message": "x"}}  # type: ignore[typeddict-unknown-key]
