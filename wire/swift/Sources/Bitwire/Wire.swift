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
public struct Envelope: Sendable, Equatable {
    public let source: Path
    public let destination: Path
    public let id: Atom
    public let correlation: Atom?
    public let payload: Value
    public init(source: Path, destination: Path, id: Atom, correlation: Atom? = nil, payload: Value) {
        self.source = source; self.destination = destination; self.id = id
        self.correlation = correlation; self.payload = payload
    }
}
public enum Termination: Sendable, Equatable { case closed; case failed(String) }
public protocol Wire: Sendable {
    func send(_ envelope: Envelope) async throws
    func receive(_ handler: @escaping @Sendable (Envelope) -> Void) throws -> @Sendable () -> Void
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
