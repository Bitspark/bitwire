#include <bitwire/wire.hpp>

#include <type_traits>
#include <utility>
#include <stdexcept>

static_assert(std::is_abstract_v<bitwire::Wire>);
static_assert(std::has_virtual_destructor_v<bitwire::Wire>);
static_assert(std::is_same_v<decltype(&bitwire::Wire::send),
    void (bitwire::Wire::*)(const bitwire::Message&)>);
static_assert(std::is_same_v<decltype(&bitwire::AddressedWire::send),
    void (bitwire::AddressedWire::*)(const bitwire::Path&, const bitwire::Message&)>);
static_assert(std::is_same_v<decltype(&bitwire::Endpoint::receive),
    bitwire::Detach (bitwire::Endpoint::*)(bitwire::Receiver)>);

static_assert(std::is_base_of_v<bitwire::AddressedWire, bitwire::Endpoint>);
static_assert(!std::is_base_of_v<bitwire::Wire, bitwire::Endpoint>);
static_assert(std::is_same_v<bitwire::WireTree, bitwire::DeixisNode<bitwire::WirePtr>>);
template<class T> concept HasReceive = requires(T& value, bitwire::Receiver receiver) { value.receive(receiver); };
template<class T> concept HasClose = requires(T& value) { value.close(); };
static_assert(!HasReceive<bitwire::Wire> && !HasClose<bitwire::Wire>);
static_assert(HasReceive<bitwire::Endpoint> && HasClose<bitwire::Endpoint>);

// Test-only tree realization; the package declares no production constructor.
template<class T>
class FixtureNode final : public bitwire::DeixisNode<T>,
    public std::enable_shared_from_this<FixtureNode<T>> {
    const T value_;
    const bitwire::Children<T> children_;
public:
    explicit FixtureNode(T value, bitwire::Children<T> children = {})
        : value_(std::move(value)), children_(std::move(children)) {}
    T own() const override { return value_; }
    bitwire::Children<T> children() const override { return children_; }
    bitwire::NodePtr<T> at(const bitwire::TreePath& path) const override {
        if (path.empty()) return this->shared_from_this();
        auto child = children_.find(path.front());
        if (child == children_.end()) return nullptr;
        return child->second->at(bitwire::TreePath(path.begin() + 1, path.end()));
    }
    bitwire::TreeParts<T> decompose() const override { return {value_, children_}; }
};

class RefusingPrimitive final : public bitwire::Wire {
public:
    void send(const bitwire::Message&) override { throw std::runtime_error("refused"); }
};

bool tree_contract() {
    auto empty = std::make_shared<FixtureNode<int>>(1);
    auto binary = std::make_shared<FixtureNode<int>>(2, bitwire::Children<int>{{{}, empty}});
    auto root = std::make_shared<FixtureNode<int>>(0, bitwire::Children<int>{
        {{}, empty}, {{0xff, 0}, binary},
        {{0xc3, 0xa9}, std::make_shared<FixtureNode<int>>(3)},
        {{0x65, 0xcc, 0x81}, std::make_shared<FixtureNode<int>>(4)},
        {{0x61, 0x2f, 0x62}, std::make_shared<FixtureNode<int>>(5)}
    });
    if (root->at({}).get() != root.get() || root->at({{}}).get() != empty.get()) return false;
    if (root->at({{0xff, 0}}).get() != binary.get()) return false;
    if (root->at({{0xc3, 0xa9}})->own() != 3) return false;
    if (root->at({{0x65, 0xcc, 0x81}})->own() != 4) return false;
    if (root->at({{0x61, 0x2f, 0x62}})->own() != 5) return false;
    if (root->at({{0x61}, {0x62}}) || root->at({{0x7f}})) return false;
    if (root->children().size() != 5) return false;
    if (root->at({{0xff, 0}, {}}) != root->at({{0xff, 0}})->at({{}})) return false;

    auto wire = std::make_shared<RefusingPrimitive>();
    auto leaf = std::make_shared<FixtureNode<bitwire::WirePtr>>(wire);
    bitwire::WireTreePtr tree = std::make_shared<FixtureNode<bitwire::WirePtr>>(
        wire, bitwire::Children<bitwire::WirePtr>{{{}, leaf}, {{0xff}, leaf}});
    auto parts = tree->decompose();
    bitwire::WireTreePtr rebuilt = std::make_shared<FixtureNode<bitwire::WirePtr>>(
        parts.own, parts.children);
    if (rebuilt->children() != tree->children() || rebuilt->own() != wire) return false;
    if (rebuilt->at({{}}) != leaf || rebuilt->at({{0xff}}) != leaf) return false;
    if (rebuilt->at({{0}})) return false;
    try {
        rebuilt->at({{}})->own()->send(bitwire::Message{});
        return false;
    } catch (const std::runtime_error&) {
        // A present refusing leaf remains distinguishable from a missing edge.
    }
    return true;
}

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
    if (!tree_contract()) return 6;
    return 0;
}
