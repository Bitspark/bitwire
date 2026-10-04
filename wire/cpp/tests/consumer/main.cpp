#include <bitwire/wire.hpp>
int main() { bitwire::Envelope e{{},{bitwire::Atom{255}}, {}, std::nullopt, bitwire::Value(bitwire::Atom{})}; return e.destination.empty(); }
