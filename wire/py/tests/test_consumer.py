import unittest
from bitwire import Atom, Tuple, Path
class Contract(unittest.TestCase):
    def test_paths_and_ground_values(self) -> None:
        path: Path = (Atom(),)
        self.assertNotEqual((), path)
        self.assertNotEqual((Atom(b'a/b'),), (Atom(b'a'), Atom(b'b')))
        self.assertNotEqual(Atom(), Tuple())
    def test_value_ownership(self) -> None:
        source = bytearray([0,255])
        value = Atom(source)
        source.clear()
        self.assertEqual(value, Atom(bytes([0,255])))
if __name__ == '__main__': unittest.main()
