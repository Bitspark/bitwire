import Bitwire
import Foundation

// An external implementation can conform without importing a runtime package.
struct RefusingAddressedWire: AddressedWire {
    enum Refusal: Error { case unavailable }
    func send(path: [String], message: Message) throws { throw Refusal.unavailable }
}

struct RefusingWire: Wire {
    func send(message: Message) throws { throw RefusingAddressedWire.Refusal.unavailable }
}

let primitive: any Wire = RefusingWire()
let wire: any AddressedWire = RefusingAddressedWire()
let address = ReturnAddress(wire: wire)
let payload = Data(#"{"integer":9007199254740993}"#.utf8)
let metadata: Metadata = ["\u{00E9}": "one", "e\u{0301}": "two"]
let message = Message(
    frame: ProfileFrame(kind: .request, id: "consumer", params: payload, meta: metadata),
    returnAddress: address
)
precondition(message.returnAddress === address)
precondition(message.frame.params == payload)
precondition(message.frame.meta?.entries.count == 2)
do {
    try primitive.send(message: message)
    fatalError("Fixture must refuse admission")
} catch RefusingAddressedWire.Refusal.unavailable {}
// Send-only access needs no receiver registration or lifecycle implementation.
print("Standalone Bitwire Swift consumer passed.")
