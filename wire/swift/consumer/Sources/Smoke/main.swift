import Bitwire
import Foundation

// An external implementation can conform without importing a runtime package.
struct RefusingWire: Wire {
    enum Refusal: Error { case unavailable }
    func send(path: [String], message: Message) throws { throw Refusal.unavailable }
    func receive(path: [String], receiver: Receiver) throws -> Detach {
        throw Refusal.unavailable
    }
    func close(code: Int, reason: String) throws {}
}

let wire: any Wire = RefusingWire()
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
try wire.close(code: 1000, reason: "consumer check")
print("Standalone Bitwire Swift consumer passed.")
