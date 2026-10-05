#include <bitwire/wire.hpp>
#include <cassert>
#include <type_traits>
int main() {
  using namespace bitwire;
  assert(Path{} != Path{Atom{}});
  assert((Path{Atom{'a','/','b'}} != Path{Atom{'a'},Atom{'b'}}));
  Value a(Atom{}), t(std::vector<Value>{}); assert(a != t);
  static_assert(std::is_base_of_v<Wire,Endpoint>);
  static_assert(std::is_base_of_v<AddressedWire,AddressedEndpoint>);
}
