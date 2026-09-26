import Bitwire
import XCTest

/// Test-only realization of the structural contract, not a production runtime.
private final class FixtureNode<Value: Sendable>: DeixisNode {
    private let value: Value
    private let entries: [TreeChild<Value>]

    init(_ value: Value, _ entries: [TreeChild<Value>] = []) {
        precondition(Set(entries.map(\.key)).count == entries.count)
        self.value = value
        self.entries = entries
    }

    func own() -> Value { value }
    func children() -> [TreeChild<Value>] { entries }
    func at(path: TreePath) -> (any DeixisNode<Value>)? {
        guard let key = path.first else { return self }
        return entries.first { $0.key == key }?.node.at(path: Array(path.dropFirst()))
    }
    func decompose() -> TreeParts<Value> { TreeParts(own: value, children: entries) }
}

private final class RefusingPrimitive: Wire {
    enum Refusal: Error { case unavailable }
    func send(message: Message) throws { throw Refusal.unavailable }
}

final class TreeContractTests: XCTestCase {
    func testGenericTreeUsesExactBytesAndDistinguishesRootEmptyAndMissing() {
        let empty = FixtureNode(1)
        let binary = FixtureNode(2, [TreeChild(key: [], node: empty)])
        let root = FixtureNode(0, [
            TreeChild(key: [], node: empty),
            TreeChild(key: [0xff, 0], node: binary),
            TreeChild(key: [0xc3, 0xa9], node: FixtureNode(3)),
            TreeChild(key: [0x65, 0xcc, 0x81], node: FixtureNode(4)),
            TreeChild(key: [0x61, 0x2f, 0x62], node: FixtureNode(5))
        ])

        XCTAssertEqual(root.at(path: [])?.own(), 0)
        XCTAssertEqual(root.at(path: [[]])?.own(), 1)
        XCTAssertEqual(root.at(path: [[0xff, 0]])?.own(), 2)
        XCTAssertEqual(root.at(path: [[0xc3, 0xa9]])?.own(), 3)
        XCTAssertEqual(root.at(path: [[0x65, 0xcc, 0x81]])?.own(), 4)
        XCTAssertEqual(root.at(path: [[0x61, 0x2f, 0x62]])?.own(), 5)
        XCTAssertNil(root.at(path: [[0x61], [0x62]]))
        XCTAssertNil(root.at(path: [[0x7f]]))
        XCTAssertEqual(root.children().count, 5)

        let nested = root.at(path: [[0xff, 0], []])
        let selected = root.at(path: [[0xff, 0]])?.at(path: [[]])
        XCTAssertTrue(nested as AnyObject === empty)
        XCTAssertTrue(selected as AnyObject === empty)
    }

    func testDecompositionPreservesCompleteChildrenAndPrimitiveIdentity() {
        let wire = RefusingPrimitive()
        let leaf = FixtureNode<any Wire>(wire)
        let root: WireTree = FixtureNode<any Wire>(wire, [
            TreeChild(key: [], node: leaf),
            TreeChild(key: [0xff], node: leaf)
        ])
        let parts = root.decompose()
        let rebuilt: WireTree = FixtureNode(parts.own, parts.children)
        XCTAssertEqual(rebuilt.children().map(\.key), [[], [0xff]])
        XCTAssertTrue(rebuilt.own() as AnyObject === wire)
        XCTAssertTrue(rebuilt.at(path: [[]]) as AnyObject === leaf)
        XCTAssertTrue(rebuilt.at(path: [[0xff]]) as AnyObject === leaf)
        XCTAssertNil(rebuilt.at(path: [[0]]))

        // Presence is structural even when that child's own capability refuses.
        XCTAssertThrowsError(try rebuilt.at(path: [[]])!.own().send(
            message: Message(frame: ProfileFrame(kind: .event))
        ))
        XCTAssertFalse(wire is any AddressedWire)
    }
}
