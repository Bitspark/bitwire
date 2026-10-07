import XCTest
@testable import Bitwire
final class ContractTests: XCTestCase {
    func testExactKeysAndUnknownValues() {
        XCTAssertNotEqual(Path(), [Atom()])
        XCTAssertNotEqual([Atom(Array("a/b".utf8))], [Atom(Array("a".utf8)), Atom(Array("b".utf8))])
        XCTAssertNotEqual(Value.tuple([.atom(Atom([255]))]), Value.atom(Atom()))
    }
}

private struct LiveSender: HydratedWire {
    func send(_ message: HydratedValue) async throws {}
}
extension ContractTests {
    func testHydratedRecursiveInterface() async throws {
        let sender: any HydratedWire = LiveSender()
        try await sender.send(.ground(.tuple([.atom(Atom([0, 255]))])))
        try await sender.send(.wire(sender))
    }
}
