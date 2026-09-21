// SPDX-License-Identifier: Apache-2.0
// Adapted from Nightseam duplex/cpp/include/nightseam/duplex/wire.hpp at
// 1c63f1c4d7e4b5987d4bd32e294177645c92ed8f. See wire/cpp/NOTICE.
#pragma once

#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <string>
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

class Wire;
using WirePtr = std::shared_ptr<Wire>;

// This local capability has stable shared_ptr identity. Copy the shared_ptr
// when routing; do not reconstruct or serialize the ReturnAddress. Keeping a
// pointer alive is distinct from closing the endpoint or releasing a live bind.
// Implementations also preserve any associated received invocation context
// through composition, including context held outside this declaration. Such
// context is local, and application-supplied metadata is not verified context.
struct ReturnAddress { WirePtr wire; };

struct Message {
    ProfileFrame frame;
    std::shared_ptr<ReturnAddress> return_address;
    bool operator==(const Message&) const = default;
};

struct Receiver {
    // Exact routes win; otherwise the longest namespace segment prefix wins.
    bool namespace_ = false;
    // Paths are relative to the origin on which this receiver registered.
    std::function<void(const Path&, const Message&)> message;
    std::function<void(Code, const std::string&)> closed;
};

// send admits or throws on refusal without invoking a destination handler on
// the sender's stack. The implementation owns bounded asynchronous dispatch.
// receive refuses duplicate registrations. Its returned detach is idempotent,
// prevents new dispatch and preserves return/cancellation access already held
// by admitted requests. Selection shares endpoint closure; mounts and forwarding
// own their registrations but do not close borrowed endpoints on detachment.
class Wire {
public:
    virtual ~Wire() = default;
    virtual void send(const Path& path, const Message& message) = 0;
    virtual Detach receive(const Path& path, Receiver receiver) = 0;
    virtual void close(Code code = 1000, std::string reason = {}) = 0;
};

} // namespace bitwire
