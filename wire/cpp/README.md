# Bitwire for C++

The header-only C++20 binding declares the shared Wire contract. It depends only
on the C++ standard library. Runtime dispatch, routing, codecs and carriers are
supplied by implementations.

```cpp
#include <bitwire/wire.hpp>

void publish(bitwire::Wire& wire) {
    bitwire::Message message;
    message.frame.kind = bitwire::ProfileKind::event;
    message.frame.data = R"({"ready":true})";
    wire.send({"status"}, message);
}
```

`Wire` grants only `send(path, message)`. `Endpoint` extends it with
`receive(receiver)` and `close`; one receiver may be attached at a time, and
its detach action is idempotent. A second active attachment is refused.
Receiver callbacks receive the relative path and complete message; routing
and matching policy belong to a separate dispatcher. A `ReturnAddress` holds
send-only `Wire` access. Paths contain opaque UTF-8 segments. Payload fields are optional raw JSON
strings; they preserve numeric spelling and distinguish absence from JSON null.
Return addresses use shared pointer identity and remain local capabilities.
Holding or destroying a pointer is distinct from calling `close` or releasing a
live binding. Implementations preserve associated received invocation context
through routing even when stored outside these declarations; it is never
serialized, and application metadata does not constitute verified context.
See the [shared contract](../../docs/wire/contract.md) and
[profile obligations](../../docs/wire/profile.md).

## Install and consume

From a Bitwire source release, choose build and install directories outside the
checkout:

```sh
cmake -S . -B /tmp/bitwire-build -DCMAKE_BUILD_TYPE=Release
cmake --build /tmp/bitwire-build --config Release
ctest --test-dir /tmp/bitwire-build -C Release --output-on-failure
cmake --install /tmp/bitwire-build --prefix /tmp/bitwire-install --config Release
```

Use platform-appropriate writable paths on Windows. The CTest checks include an
installed consumer, configured from a copied fixture using only the installed
package. They check declarations, payload preservation and packaging; runtime
behavioral conformance is a separate requirement.

Consumers select the install prefix with `CMAKE_PREFIX_PATH` and link the exported
target:

```cmake
find_package(Bitwire 0.2 CONFIG REQUIRED)
target_link_libraries(my_application PRIVATE Bitwire::wire)
```

The target supplies the include directory and C++20 requirement. The package
contains no compiled runtime library and fetches no dependencies. Embedded source
consumers can instead use `add_subdirectory` and the same target; tests default to
off when Bitwire is a subproject.

The 0.2.0 source package separates access from endpoint control. Availability
of a source release is recorded in the repository delivery documentation. The [notice](NOTICE) records the adapted declarations and
their source revision; the project uses the [Apache-2.0 license](../../LICENSE).
