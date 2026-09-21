import Bitwire
import Foundation
import XCTest

/// A type-checking fixture, not an endpoint or a conformance implementation.
private struct RefusingWire: Wire {
    enum Refusal: Error { case unavailable }

    func send(path: [String], message: Message) throws { throw Refusal.unavailable }
    func receive(path: [String], receiver: Receiver) throws -> Detach {
        throw Refusal.unavailable
    }
    func close(code: Int, reason: String) throws {}
}

final class ContractTests: XCTestCase {
    func testReturnCapabilityKeepsReferenceIdentityAcrossMessageCopies() {
        let first = ReturnAddress(wire: RefusingWire())
        let second = ReturnAddress(wire: RefusingWire())
        let message = Message(frame: ProfileFrame(kind: .request, id: "1"), returnAddress: first)
        let copy = message

        XCTAssertTrue(copy.returnAddress === first)
        XCTAssertFalse(copy.returnAddress === second)
    }

    func testPayloadKeepsPrecisionSpellingAndAbsenceSeparateFromNull() {
        let raw = Data(#"{"integer":9007199254740993,"exponent":1e999}"#.utf8)
        let frame = ProfileFrame(kind: .request, id: "1", params: raw)
        let null = ProfileFrame(kind: .response, id: "1", result: Data("null".utf8))

        XCTAssertEqual(frame.params, raw)
        XCTAssertNil(frame.result)
        XCTAssertEqual(null.result, Data("null".utf8))
        XCTAssertEqual(frame.version, 1)
    }

    func testMetadataPreservesCanonicallyEquivalentKeyAndValueSpellings() {
        let composed = "\u{00E9}"
        let decomposed = "e\u{0301}"
        let metadata: Metadata = [composed: "first", decomposed: "second"]

        XCTAssertEqual(metadata.entries.count, 2)
        XCTAssertEqual(metadata[composed], "first")
        XCTAssertEqual(metadata[decomposed], "second")
        XCTAssertNotEqual(Metadata([("key", composed)]), Metadata([("key", decomposed)]))
        XCTAssertEqual(metadata.filter { $0.key.utf8.elementsEqual(composed.utf8) },
                       Metadata([(composed, "first")]))
    }

    func testContractValuesCanCrossSendableBoundary() {
        func accept<T: Sendable>(_ value: T) {}
        let receiver = Receiver(namespace: true, message: { _, _ in })
        let detach: Detach = {}

        accept(RefusingWire())
        accept(ProfileError(code: "refused", message: "closed"))
        accept(ProfileFrame(kind: .cancel, id: "1"))
        accept(Message(frame: ProfileFrame(kind: .event, data: Data("null".utf8))))
        accept(ReturnAddress(wire: RefusingWire()))
        accept(receiver)
        accept(detach)
    }
}
