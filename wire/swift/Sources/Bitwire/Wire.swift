// Copyright 2026 Bitspark and the Bitwire contributors.
// SPDX-License-Identifier: Apache-2.0
// Adapted from Nightseam's Swift Wire declarations at
// 1c63f1c4d7e4b5987d4bd32e294177645c92ed8f; see ../../NOTICE.

import Foundation

/// The four frame kinds in the retained nightseam.duplex/1 profile.
public enum ProfileKind: String, Sendable {
    case request, response, event, cancel
}

/// Public error data, independent of a runtime error type.
public struct ProfileError: Sendable {
    public var code: String
    public var message: String
    public var data: Data?

    public init(code: String, message: String, data: Data? = nil) {
        self.code = code
        self.message = message
        self.data = data
    }
}

/// Profile data. The send path supplies the operation name.
///
/// JSON payloads retain their encoded bytes and numeric precision: nil means
/// absent, while Data("null".utf8) means JSON null. These declarations neither
/// validate JSON nor provide a codec; the profile implementation does both.
public struct ProfileFrame: Sendable {
    public var version: Int
    public var kind: ProfileKind
    public var id: String?
    public var params: Data?
    public var result: Data?
    public var error: ProfileError?
    public var data: Data?
    public var traceparent: String?
    public var tracestate: String?
    public var meta: Metadata?

    public init(
        version: Int = 1,
        kind: ProfileKind,
        id: String? = nil,
        params: Data? = nil,
        result: Data? = nil,
        error: ProfileError? = nil,
        data: Data? = nil,
        traceparent: String? = nil,
        tracestate: String? = nil,
        meta: Metadata? = nil
    ) {
        self.version = version
        self.kind = kind
        self.id = id
        self.params = params
        self.result = result
        self.error = error
        self.data = data
        self.traceparent = traceparent
        self.tracestate = tracestate
        self.meta = meta
    }
}

/// A local capability with reference identity, preserved through composition.
/// This object is never an encoded envelope member. Runtimes may associate
/// opaque received context with its identity; forwarding must retain that
/// association. Caller-supplied frame fields do not establish verified context.
public final class ReturnAddress: Sendable {
    public let wire: any Wire

    public init(wire: any Wire) {
        self.wire = wire
    }
}

/// A profile frame and its optional local return capability.
public struct Message: Sendable {
    public var frame: ProfileFrame
    public var returnAddress: ReturnAddress?

    public init(frame: ProfileFrame, returnAddress: ReturnAddress? = nil) {
        self.frame = frame
        self.returnAddress = returnAddress
    }
}

/// Deliveries use paths relative to the endpoint origin. Dispatch policy is external.
public struct Receiver: Sendable {
    public var message: @Sendable ([String], Message) -> Void
    public var closed: @Sendable (Int, String) -> Void

    public init(
        message: @escaping @Sendable ([String], Message) -> Void,
        closed: @escaping @Sendable (Int, String) -> Void = { _, _ in }
    ) {
        self.message = message
        self.closed = closed
    }
}

/// An idempotent receive detachment. It does not close the endpoint.
public typealias Detach = @Sendable () -> Void

/// Access to an origin. Paths are sequences of opaque Unicode-scalar strings.
///
/// Path segment identity must preserve scalar spelling; Swift String equality
/// normalizes canonically equivalent spellings and must not be used as a route
/// identity test. Compare UTF-8/scalar sequences instead. Empty segments and
/// slashes within a segment have no special meaning.
///
/// Wire grants send access only. Implementations own admission and dispatch;
/// the profile retains correlation, identity and live-reference obligations.
public protocol Wire: Sendable {
    /// Complete on admission or throw on refusal, without invoking destination
    /// application code on the sender's stack or awaiting a response.
    func send(path: [String], message: Message) throws

}

/// Endpoint control is separate from send-only Wire access.
public protocol Endpoint: Wire {
    /// Attach one receiver; refuse another while the attachment is active.
    /// Detachment prevents new dispatch; admitted work retains its return path.
    func receive(receiver: Receiver) throws -> Detach

    /// End this endpoint with the profile's code and reason.
    func close(code: Int, reason: String) throws
}
