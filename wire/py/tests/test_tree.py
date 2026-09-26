"""Independent finite structural fixture; no production tree implementation."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Generic, TypeVar
import unittest

from bitwire import DeixisNode, Key, Message, TreePath, Wire, WireTree

T = TypeVar("T")


@dataclass(frozen=True)
class Node(Generic[T]):
    value: T
    entries: tuple[tuple[Key, DeixisNode[T]], ...] = ()

    def own(self) -> T:
        return self.value

    def children(self) -> Sequence[tuple[Key, DeixisNode[T]]]:
        return self.entries

    def at(self, path: TreePath) -> DeixisNode[T] | None:
        node: DeixisNode[T] = self
        for key in path:
            child = next((child for name, child in node.children() if name == key), None)
            if child is None:
                return None
            node = child
        return node

    def decompose(self) -> tuple[T, Sequence[tuple[Key, DeixisNode[T]]]]:
        return self.value, self.entries


class RefusingWire:
    def send(self, message: Message) -> None:
        raise RuntimeError("refused")


class RecordingWire:
    def __init__(self) -> None:
        self.messages: list[Message] = []

    def send(self, message: Message) -> None:
        self.messages.append(message)


class TreeTests(unittest.TestCase):
    def test_complete_structure_preserves_binary_empty_and_missing_keys(self) -> None:
        child: WireTree = Node[Wire](RefusingWire())
        binary: WireTree = Node[Wire](RefusingWire())
        tree: WireTree = Node[Wire](RefusingWire(), ((b"", child), (b"\xff\x00", binary)))
        self.assertIs(tree.at([]), tree)
        self.assertIs(tree.at([b""]), child)
        self.assertIs(tree.at([b"\xff\x00"]), binary)
        self.assertIsNone(tree.at([b"missing"]))
        self.assertIsNone(tree.at([b"", b""]))
        self.assertEqual([key for key, _ in tree.children()], [b"", b"\xff\x00"])
        value, children = tree.decompose()
        self.assertIs(value, tree.own())
        rebuilt: WireTree = Node[Wire](value, tuple(children))
        self.assertIs(rebuilt.at([b""]), child)
        with self.assertRaisesRegex(RuntimeError, "refused"):
            child.own().send(Message({"version": 1, "kind": "event", "data": None}))
        # A present refusing leaf is still observable, unlike a missing child.
        self.assertEqual(child.children(), ())

    def test_selected_send_is_own_send_and_retains_message_identity(self) -> None:
        root = RecordingWire()
        destination = RecordingWire()
        tree: WireTree = Node[Wire](root, ((b"route", Node[Wire](destination)),))
        message = Message({"version": 1, "kind": "event", "data": {"value": 1}})
        selected = tree.at([b"route"])
        assert selected is not None
        selected.own().send(message)
        self.assertEqual(root.messages, [])
        self.assertIs(destination.messages[0], message)


if __name__ == "__main__":
    unittest.main()
