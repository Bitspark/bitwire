import Bitwire
let path: Path = [Atom([255])]
let message: Value = .atom(Atom())
precondition(path != [])
precondition(message != .tuple([]))
print(BitwireMetadata.version)
