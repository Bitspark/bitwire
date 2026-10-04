#include <bitwire/wire.hpp>
#include <cassert>
int main() {
  using namespace bitwire;
  assert(Path{} != Path{Atom{}});
  assert((Path{Atom{'a','/','b'}} != Path{Atom{'a'},Atom{'b'}}));
  Value a(Atom{}), t(std::vector<Value>{}); assert(a != t);
  Envelope e{{}, {Atom{0,255}}, {}, std::nullopt, Value(std::vector<Value>{a})};
  assert(!e.correlation.has_value());
}
