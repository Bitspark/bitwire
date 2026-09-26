"""Consumer observations against declarations, not a runtime conformance suite."""

from __future__ import annotations

import asyncio
import inspect
import unittest
from collections.abc import Callable

from bitwire import Endpoint, Message, Path, Receiver, ReturnAddress, AddressedWire


class RecordingEndpoint:
    """Independent structural consumer fixture; no inheritance or routing runtime."""

    def __init__(self) -> None:
        self.sent: list[tuple[tuple[str, ...], Message]] = []
        self.receiver: Receiver | None = None
        self.attachment: object | None = None
        self.ending: tuple[int, str] | None = None

    def __eq__(self, other: object) -> bool:
        raise AssertionError("ReturnAddress must not compare the wrapped AddressedWire")

    def send(self, path: Path, message: Message) -> None:
        self.sent.append((tuple(path), message))

    def receive(self, receiver: Receiver) -> Callable[[], None]:
        if self.ending is not None:
            raise RuntimeError("endpoint closed")
        if self.receiver is not None:
            raise RuntimeError("receiver already attached")
        token = object()
        self.receiver = receiver
        self.attachment = token

        def detach() -> None:
            if self.attachment is token:
                self.receiver = None
                self.attachment = None

        return detach

    def close(self, code: int = 1000, reason: str = "") -> None:
        if self.ending is not None:
            return
        self.ending = (code, reason)
        receiver = self.receiver
        self.receiver = None
        self.attachment = None
        if receiver is not None and receiver.closed is not None:
            receiver.closed(code, reason)


class ConsumerTests(unittest.TestCase):
    def test_structural_consumer_keeps_path_frame_and_return_object(self) -> None:
        endpoint = RecordingEndpoint()
        wire: AddressedWire = endpoint
        replies = ReturnAddress(RecordingEndpoint())
        request = Message(
            {"version": 1, "kind": "request", "id": "r1", "params": {"count": 2**80}},
            replies,
        )
        self.assertIsInstance(endpoint, AddressedWire)
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

        receiver = Receiver(message=delivered)
        detach = endpoint.receive(receiver)
        request = Message({"version": 1, "kind": "event", "data": None})

        async def dispatch() -> None:
            registered = endpoint.receiver
            assert registered is not None and registered.message is not None
            result = registered.message(["reply", ""], request)
            if inspect.isawaitable(result):
                await result

        asyncio.run(dispatch())
        self.assertEqual(observed, [(("reply", ""), request)])
        detach()
        detach()
        self.assertIsNone(endpoint.receiver)
        self.assertIsNone(endpoint.ending)

    def test_attachment_ownership_and_stale_detach(self) -> None:
        endpoint: Endpoint = RecordingEndpoint()
        first = Receiver()
        detach = endpoint.receive(first)
        with self.assertRaises(RuntimeError):
            endpoint.receive(first)
        detach()
        second = Receiver()
        second_detach = endpoint.receive(second)
        detach()
        assert isinstance(endpoint, RecordingEndpoint)
        self.assertIs(endpoint.receiver, second)
        second_detach()
        self.assertIsNone(endpoint.receiver)

    def test_close_notifies_only_active_attachment_once(self) -> None:
        endpoint = RecordingEndpoint()
        endings: list[tuple[int, str]] = []
        detached: list[tuple[int, str]] = []
        endpoint.receive(Receiver(closed=lambda c, r: detached.append((c, r))))()
        endpoint.receive(Receiver(closed=lambda c, r: endings.append((c, r))))
        endpoint.close(1000, "done")
        endpoint.close(1001, "again")
        self.assertEqual(endings, [(1000, "done")])
        self.assertEqual(detached, [])
        with self.assertRaises(RuntimeError):
            endpoint.receive(Receiver())

    def test_send_only_wire_requires_no_endpoint_control(self) -> None:
        class Access:
            def send(self, path: Path, message: Message) -> None:
                pass

        access: AddressedWire = Access()
        self.assertIsInstance(access, AddressedWire)
        self.assertNotIsInstance(access, Endpoint)
        self.assertIs(ReturnAddress(access).wire, access)

    def test_closed_callback_is_independent_from_message_callback(self) -> None:
        endings: list[tuple[int, str]] = []
        receiver = Receiver(closed=lambda code, reason: endings.append((code, reason)))
        assert receiver.closed is not None
        receiver.closed(1000, "complete")
        self.assertEqual(endings, [(1000, "complete")])
        self.assertIsNone(receiver.message)



if __name__ == "__main__":
    unittest.main()
