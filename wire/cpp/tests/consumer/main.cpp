#include <bitwire/wire.hpp>
int main() { bitwire::Path path{bitwire::Atom{255}}; bitwire::Value message(bitwire::Atom{}); return path.empty() || !message.is_atom(); }
