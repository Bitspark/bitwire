// SPDX-License-Identifier: Apache-2.0
// Adapted from Nightseam duplex/cpp/include/nightseam/duplex/wire.hpp at
// 1c63f1c4d7e4b5987d4bd32e294177645c92ed8f. See wire/cpp/NOTICE.
#pragma once

#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace bitwire {

// Segments are opaque Unicode-scalar strings encoded as UTF-8, with no
// normalization or interpretation of slashes, dots or empty segments.
using Path = std::vector<std::string>;
using Code = int;
using Detach = std::function<void()>;

enum class ProfileKind { request, response, event, cancel };

struct ProfileError {
    std::string code;
    std::string message;
    std::optional<std::string> data;
    bool operator==(const ProfileError&) const = default;
};

// Payload fields retain encoded JSON, including numeric lexemes. An absent
// optional is distinct from the present JSON text "null". Validation and
// physical encoding belong to the profile implementation. The separate send
// path supplies the method/event name, so this frame has no competing name.
struct ProfileFrame {
    int version = 1;
    ProfileKind kind = ProfileKind::event;
    std::string id;
    std::optional<std::string> params;
    std::optional<std::string> result;
    std::optional<ProfileError> error;
    std::optional<std::string> data;
    std::string traceparent;
    std::string tracestate;
    std::map<std::string, std::string> meta;
    bool operator==(const ProfileFrame&) const = default;
};

class AddressedWire;
using AddressedWirePtr = std::shared_ptr<AddressedWire>;

// This local capability has stable shared_ptr identity. Copy the shared_ptr
// when routing; do not reconstruct or serialize the ReturnAddress. Keeping a
// pointer alive is distinct from closing the endpoint or releasing a live bind.
// Implementations also preserve any associated received invocation context
// through composition, including context held outside this declaration. Such
// context is local, and application-supplied metadata is not verified context.
struct ReturnAddress { AddressedWirePtr wire; };

struct Message {
    ProfileFrame frame;
    std::shared_ptr<ReturnAddress> return_address;
    bool operator==(const Message&) const = default;
};

struct Receiver {
    // Paths are relative to the endpoint origin; dispatch policy is external.
    std::function<void(const Path&, const Message&)> message;
    std::function<void(Code, const std::string&)> closed;
};

// send admits or throws on refusal without invoking a destination handler on
// the sender's stack. The implementation owns bounded asynchronous dispatch.
// Wire is an addressless interaction primitive. It grants no path selection,
// receiver attachment or closure rights. Addressing belongs to WireTree.
class Wire {
public:
    virtual ~Wire() = default;
    virtual void send(const Message& message) = 0;
};
using WirePtr = std::shared_ptr<Wire>;

// Exact arbitrary byte keys: no UTF-8 requirement, normalization or separators.
using Key = std::vector<std::uint8_t>;
using TreePath = std::vector<Key>;

template<class T> class DeixisNode;
template<class T> using NodePtr = std::shared_ptr<const DeixisNode<T>>;
template<class T> using Children = std::map<Key, NodePtr<T>>;

template<class T> struct TreeParts {
    T own;
    Children<T> children;
};

// The complete finite, acyclic structure, independent of its payload type.
// Nodes have an own value and a complete map of non-null children. Structure is
// stable; shared child identities are allowed, cycles are not. Implementations
// and production constructors belong to a runtime, not this contract package.
template<class T> class DeixisNode {
public:
    virtual ~DeixisNode() = default;
    virtual T own() const = 0;
    virtual Children<T> children() const = 0;
    // Empty path selects this node. Missing edges return nullptr, distinct from
    // an existing child whose primitive refuses. One empty key is a child edge.
    virtual NodePtr<T> at(const TreePath& path) const = 0;
    // Complete parts: reconstructing from them preserves keys and child/payload
    // identities, including empty and refusing branches. Never a filtered view.
    virtual TreeParts<T> decompose() const = 0;
};

// WireTree implementations must supply a non-null WirePtr as their own value;
// shared ownership preserves that capability's identity.
using WireTree = DeixisNode<WirePtr>;
using WireTreePtr = NodePtr<WirePtr>;

// Explicit compatibility surface for protocol paths. This is not a WireTree:
// addressed sending does not establish a complete enumerable Deixis structure.
class AddressedWire {
public:
    virtual ~AddressedWire() = default;
    virtual void send(const Path& path, const Message& message) = 0;
};

// An endpoint owns one active receive attachment. A second attachment is refused.
// Detach is idempotent, prevents new dispatch, and retains admitted return access.
// Receive and Close are separate from send-only AddressedWire access.
class Endpoint : public AddressedWire {
public:
    virtual Detach receive(Receiver receiver) = 0;
    virtual void close(Code code = 1000, std::string reason = {}) = 0;
};

} // namespace bitwire
