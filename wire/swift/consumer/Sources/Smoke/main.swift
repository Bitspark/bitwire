import Bitwire
let e = Envelope(source: [], destination: [Atom([255])], id: Atom(), payload: .tuple([]))
precondition(e.destination != e.source)
print(BitwireMetadata.version)
