"""Compile-only consumers, including rejections guarded by unused-ignore checks."""

from typing import assert_type

from bitwire import (
    CancelFrame,
    ErrorFrame,
    Endpoint,
    EventFrame,
    Message,
    Path,
    ProfileFrame,
    ProfileKind,
    Receiver,
    RequestFrame,
    ResultFrame,
    ReturnAddress,
    AddressedWire,
    Wire,
    WireTree,
)


def consume(wire: AddressedWire, endpoint: Endpoint, frame: ProfileFrame) -> None:
    address = ReturnAddress(wire)
    wire.send(["scope", ""], Message(frame, address))
    assert_type(address.wire, AddressedWire)
    kind: ProfileKind = frame["kind"]
    assert_type(kind, ProfileKind)
    if frame["kind"] == "request":
        assert_type(frame["id"], str)

    async def delivered(path: Path, message: Message) -> None:
        assert_type(message.return_address, ReturnAddress | None)

    endpoint.receive(Receiver(message=delivered))()
    wire.receive(Receiver())  # type: ignore[attr-defined]
    wire.close()  # type: ignore[attr-defined]
    wire.send([42], Message(frame))  # type: ignore[list-item]


def consume_tree(tree: WireTree, primitive: Wire, message: Message) -> None:
    primitive.send(message)
    assert_type(tree.own(), Wire)
    selected = tree.at([b"", b"\xff\x00"])
    if selected is not None:
        selected.own().send(message)
    own, children = tree.decompose()
    assert_type(own, Wire)
    for key, child in children:
        assert_type(key, bytes)
        assert_type(child, WireTree)
    primitive.send([], message)  # type: ignore[call-arg,arg-type]
    tree.at(["text"])  # type: ignore[list-item]
    ReturnAddress(primitive)  # type: ignore[arg-type]


request: RequestFrame = {"version": 1, "kind": "request", "id": "1", "params": {}}
result: ResultFrame = {"version": 1, "kind": "response", "id": "1", "result": None}
error: ErrorFrame = {"version": 1, "kind": "response", "id": "1", "error": {"code": "no", "message": "No"}}
event: EventFrame = {"version": 1, "kind": "event", "data": None}
cancel: CancelFrame = {"version": 1, "kind": "cancel", "id": "1"}
invalid_version: RequestFrame = {"version": 2, "kind": "request", "id": "1", "params": {}}  # type: ignore[typeddict-item]
contradictory: ResultFrame = {"version": 1, "kind": "response", "id": "1", "result": None, "error": {"code": "x", "message": "x"}}  # type: ignore[typeddict-unknown-key]
