import XCTest
@testable import Bitwire
final class ContractTests: XCTestCase {
    func testExactKeysAndUnknownValues() {
        XCTAssertNotEqual(Path(), [Atom()])
        XCTAssertNotEqual([Atom(Array("a/b".utf8))], [Atom(Array("a".utf8)), Atom(Array("b".utf8))])
        XCTAssertNotEqual(Value.tuple([.atom(Atom([255]))]), Value.atom(Atom()))
    }
}
