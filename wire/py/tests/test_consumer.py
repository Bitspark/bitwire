import unittest
from bitwire import Atom, Tuple, Envelope
class Contract(unittest.TestCase):
    def test_paths_and_ground_values(self) -> None:
        self.assertNotEqual((), (Atom(),))
        self.assertNotEqual((Atom(b'a/b'),), (Atom(b'a'), Atom(b'b')))
        e = Envelope((), (Atom(b'\x00\xff'),), Atom(), Tuple((Atom(b'unknown'),)))
        self.assertIsNone(e.correlation)
        self.assertNotEqual(e, Envelope(e.source, e.destination, e.id, e.payload, Atom()))
    def test_ownership(self) -> None:
        keys = [Atom(b'key')]
        e = Envelope((), keys, Atom(), Atom())  # type: ignore[arg-type]
        keys.clear()
        self.assertEqual(len(e.destination), 1)
        with self.assertRaises(TypeError): Envelope((), ('text',), Atom(), Atom())  # type: ignore[arg-type]
if __name__ == '__main__': unittest.main()
