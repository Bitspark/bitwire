import XCTest
@testable import Bitwire
final class ContractTests: XCTestCase {
    func testExactKeysAndUnknownValues() {
        XCTAssertNotEqual(Path(), [Atom()])
        XCTAssertNotEqual([Atom(Array("a/b".utf8))], [Atom(Array("a".utf8)), Atom(Array("b".utf8))])
        let e = Envelope(source: [], destination: [Atom([0,255])], id: Atom(), payload: .tuple([.atom(Atom([255]))]))
        XCTAssertNil(e.correlation)
        XCTAssertNotEqual(e.payload, Value.atom(Atom()))
    }
}
