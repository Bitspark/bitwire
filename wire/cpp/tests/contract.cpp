#include <bitwire/wire.hpp>

#include <type_traits>
#include <utility>

static_assert(std::is_abstract_v<bitwire::Wire>);
static_assert(std::has_virtual_destructor_v<bitwire::Wire>);
static_assert(std::is_same_v<decltype(&bitwire::Wire::send),
    void (bitwire::Wire::*)(const bitwire::Path&, const bitwire::Message&)>);
static_assert(std::is_same_v<decltype(&bitwire::Endpoint::receive),
    bitwire::Detach (bitwire::Endpoint::*)(bitwire::Receiver)>);

static_assert(std::is_base_of_v<bitwire::Wire, bitwire::Endpoint>);
template<class T> concept HasReceive = requires(T& value, bitwire::Receiver receiver) { value.receive(receiver); };
template<class T> concept HasClose = requires(T& value) { value.close(); };
static_assert(!HasReceive<bitwire::Wire> && !HasClose<bitwire::Wire>);
static_assert(HasReceive<bitwire::Endpoint> && HasClose<bitwire::Endpoint>);

// Declaration/value checks only: this is not a runtime or routing conformance
// test. It guards against silently converting JSON or copying capability data
// in place of preserving shared local capability identity.
int main() {
    bitwire::Message original;
    original.frame.kind = bitwire::ProfileKind::request;
    original.frame.id = "call-1";
    original.frame.params = R"({"large":9007199254740993,"exponent":1e+09})";
    original.return_address = std::make_shared<bitwire::ReturnAddress>();
    auto copied = original;
    if (copied != original || copied.return_address.get() != original.return_address.get()) return 1;
    if (copied.frame.params != original.frame.params) return 2;
    copied.frame.result = "null";
    if (!copied.frame.result || original.frame.result) return 3;
    if (bitwire::Path{} == bitwire::Path{""}) return 4;
    if (bitwire::Path{"a/b"} == bitwire::Path{"a", "b"}) return 5;
    return 0;
}
