#include <bitwire/wire.hpp>

// A consumer can implement the interface with only installed Bitwire headers
// and the standard library. This recorder is a package fixture, not a runtime.
class Recorder final : public bitwire::AddressedWire {
public:
    bitwire::Path path;
    bitwire::Message message;
    void send(const bitwire::Path& relative, const bitwire::Message& value) override {
        path = relative;
        message = value;
    }
};

class PrimitiveRecorder final : public bitwire::Wire {
public:
    bitwire::Message message;
    void send(const bitwire::Message& value) override { message = value; }
};

int main() {
    auto recorder = std::make_shared<Recorder>();
    bitwire::AddressedWirePtr endpoint = recorder;
    auto reply = std::make_shared<bitwire::ReturnAddress>(bitwire::ReturnAddress{endpoint});
    bitwire::Message message;
    message.frame.data = R"({"number":9007199254740993})";
    message.return_address = reply;
    endpoint->send({"opaque/key", ""}, message);
    PrimitiveRecorder primitive;
    primitive.send(message);
    const bool intact = recorder->path == bitwire::Path{"opaque/key", ""}
        && recorder->message.frame.data == message.frame.data
        && recorder->message.return_address.get() == reply.get()
        && primitive.message == message;
    recorder->message.return_address.reset(); // Do not keep a fixture ownership cycle.
    return intact ? 0 : 1;
}
