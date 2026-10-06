import Foundation
public struct Atom: Sendable, Hashable {
    public let bytes: [UInt8]
    public init(_ bytes: [UInt8] = []) { self.bytes = bytes }
}
public indirect enum Value: Sendable, Equatable {
    case atom(Atom)
    case tuple([Value])
}
public typealias Path = [Atom]
public enum Termination: Sendable, Equatable { case closed; case failed(String) }
public protocol Wire: Sendable { func send(_ message: Value) async throws }
public protocol Endpoint: Wire {
    func receive(_ handler: @escaping @Sendable (Value) -> Void) throws -> @Sendable () -> Void
    func closed() async -> Termination
    func close() async
}
public protocol AddressedWire: Sendable { func send(_ path: Path, _ message: Value) async throws }
public protocol AddressedEndpoint: AddressedWire {
    func receive(_ handler: @escaping @Sendable (Path, Value) -> Void) throws -> @Sendable () -> Void
    func closed() async -> Termination
    func close() async
}
public typealias Children<T> = [(Atom, any DeixisNode<T>)]
public struct Parts<T> { public let own: T; public let children: Children<T>
    public init(own: T, children: Children<T>) { self.own = own; self.children = children }
}
public protocol DeixisNode<T> {
    associatedtype T
    func own() -> T
    func children() -> Children<T>
    func at(_ path: Path) -> (any DeixisNode<T>)?
    func decompose() -> Parts<T>
}

public typealias WireNode = any DeixisNode<any Wire>
