"""Consumer observations against declarations, not a runtime conformance suite."""

from __future__ import annotations

import asyncio
import inspect
import unittest
from collections.abc import Callable

from bitwire import Message, Path, Receiver, ReturnAddress, Wire


class RecordingEndpoint:
    """Independent structural consumer fixture; no inheritance or routing runtime."""

    def __init__(self) -> None:
        self.sent: list[tuple[tuple[str, ...], Message]] = []
        self.receivers: dict[tuple[str, ...], Receiver] = {}
        self.ending: tuple[int, str] | None = None

    def __eq__(self, other: object) -> bool:
        raise AssertionError("ReturnAddress must not compare the wrapped Wire")

    def send(self, path: Path, message: Message) -> None:
        self.sent.append((tuple(path), message))

    def receive(self, path: Path, receiver: Receiver) -> Callable[[], None]:
        key = tuple(path)
        self.receivers[key] = receiver

        def detach() -> None:
            self.receivers.pop(key, None)

        return detach

    def close(self, code: int = 1000, reason: str = "") -> None:
        self.ending = (code, reason)


class ConsumerTests(unittest.TestCase):
    def test_structural_consumer_keeps_path_frame_and_return_object(self) -> None:
        endpoint = RecordingEndpoint()
        wire: Wire = endpoint
        replies = ReturnAddress(RecordingEndpoint())
        request = Message(
            {"version": 1, "kind": "request", "id": "r1", "params": {"count": 2**80}},
            replies,
        )
        self.assertIsInstance(endpoint, Wire)
        for path in ([], [""], ["a/b"], ["a", "b"], ["\u03bb", "\U0001f30d"]):
            wire.send(path, request)

        self.assertEqual(len({path for path, _ in endpoint.sent}), 5)
        for _, delivered in endpoint.sent:
            self.assertIs(delivered, request)
            self.assertIs(delivered.frame, request.frame)
            self.assertIs(delivered.return_address, replies)

    def test_return_identity_is_independent_of_wire_equality_and_hashing(self) -> None:
        endpoint = RecordingEndpoint()
        first, second = ReturnAddress(endpoint), ReturnAddress(endpoint)
        self.assertNotEqual(first, second)
        self.assertEqual(first, first)
        self.assertEqual(len({first, second}), 2)
        self.assertIs(first.wire, endpoint)

    def test_async_receiver_and_detach_are_usable_by_a_consumer(self) -> None:
        endpoint = RecordingEndpoint()
        observed: list[tuple[tuple[str, ...], Message]] = []

        async def delivered(path: Path, message: Message) -> None:
            await asyncio.sleep(0)
            observed.append((tuple(path), message))

        receiver = Receiver(namespace=True, message=delivered)
        detach = endpoint.receive(["reply"], receiver)
        request = Message({"version": 1, "kind": "event", "data": None})

        async def dispatch() -> None:
            registered = endpoint.receivers[("reply",)]
            self.assertTrue(registered.namespace)
            assert registered.message is not None
            result = registered.message(["reply", ""], request)
            if inspect.isawaitable(result):
                await result

        asyncio.run(dispatch())
        self.assertEqual(observed, [(("reply", ""), request)])
        detach()
        detach()
        self.assertEqual(endpoint.receivers, {})
        self.assertIsNone(endpoint.ending)

    def test_closed_callback_is_independent_from_message_callback(self) -> None:
        endings: list[tuple[int, str]] = []
        receiver = Receiver(closed=lambda code, reason: endings.append((code, reason)))
        assert receiver.closed is not None
        receiver.closed(1000, "complete")
        self.assertEqual(endings, [(1000, "complete")])
        self.assertIsNone(receiver.message)
        self.assertFalse(receiver.namespace)


if __name__ == "__main__":
    unittest.main()
