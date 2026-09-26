# Bitwire for Java

**Source contract: 0.3.0; publication pending.** `Wire` is the addressless
primitive `send(message)`. `WireTree = DeixisNode<Wire>` provides the complete
finite, acyclic structure: own value, complete byte-keyed children, partial
selection and decomposition. Keys are exact arbitrary bytes, including empty
and non-UTF-8 keys. Empty path selects self; a missing edge is distinct from a
present refusing primitive. Recomposition preserves own and child identities.

This is symmetric with Bitstore's `Data.read()` primitive and
`DataTree = DeixisNode<Data>`. Derived sending selects the node and invokes its
own Wire. Construction and derived operators belong in bitruntime; these
packages publish declarations and criteria, not a production tree runtime.
See [decision 0012](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0012-explicit-data-and-wire-trees.md)
and the [migration guide](https://github.com/Bitspark/bitwire/blob/main/docs/migration-0.3.md).

`AddressedWire` explicitly names the former `Wire.send(path, message)` surface.
It is not a full WireTree. `Endpoint` extends AddressedWire, and return
capabilities retain AddressedWire so the existing response/lifecycle path
space, local identity, received context and closure rules remain intact.
Carrier paths remain exact Unicode-scalar strings under unchanged `bitwire/1`;
they do not imply support for arbitrary tree byte keys on that carrier.

The following addressed-carrier examples use the **0.3 source names**. Older
0.2.0 artifacts used `Wire` for the addressed interface; their release evidence
does not validate the renamed declarations or full structural trees.

`dev.bitspark:bitwire:0.3.0` presents the shared relative-path AddressedWire contract
for Java 21. It has no runtime dependencies. The public Java package and automatic
module name are both `dev.bitspark.bitwire`.

Version 0.2.0 is available on [Maven Central](https://repo.maven.apache.org/maven2/dev/bitspark/bitwire/0.2.0/).
The [publication run](https://github.com/Bitspark/bitwire/actions/runs/35589087610)
signed and published the binary, POM, sources and Javadoc, then compiled and ran
an independent consumer using only Central resolution in a fresh Maven repository.
The immutable 0.1.0 release retains its [original API](https://github.com/Bitspark/bitwire/blob/v0.1.0/wire/java/README.md).

```xml
<dependency>
  <groupId>dev.bitspark</groupId>
  <artifactId>bitwire</artifactId>
  <version>0.3.0</version>
</dependency>
```

```java
import dev.bitspark.bitwire.*;
import java.util.List;

void request(AddressedWire endpoint, AddressedWire replies) {
    var frame = new ProfileFrame.Request("r1", new JsonValue("9007199254740993"));
    endpoint.send(List.of("cell", "get"), new Message(frame, new ReturnAddress(replies)));
}
```

`AddressedWire` exposes only `send(List<String>, Message)`. `Endpoint extends AddressedWire` adds
`receive(Receiver)` and `close(int, String)` for the endpoint owner. Only one
receiver may be attached; duplicates are refused. It receives every delivered
relative path and the complete message. `receive` returns an idempotent `Runnable`
detach operation that cannot remove a replacement receiver. Path matching is a
separate routing policy. The endpoint implementation admits or
refuses work and owns asynchronous dispatch, bounds and termination. This package
does not implement a runtime, selection, mounting, forwarding or a codec.

Paths retain their exact Unicode-scalar segments. In particular, `List.of()`,
`List.of("")`, `List.of("a/b")` and `List.of("a", "b")` remain different paths.
Endpoint implementations validate paths; this interface does not normalize them.

`ProfileFrame` is a sealed family of request, response, event and cancellation
records, with profile version 1. `JsonValue` preserves encoded JSON verbatim,
including arbitrary numeric precision. Codecs and JSON validation belong to the
profile implementation. A Java `null` in an optional payload field means absent;
`new JsonValue("null")` means present JSON null. A response has exactly one result
or error. Request and event metadata is copied on construction.

`ReturnAddress` is a local identity object. Routing preserves the same object
reference even if its AddressedWire overrides `equals`; it is never serialized. These
declarations retain `bitwire/1` (historical alias `nightseam.duplex/1`) and
introduce no new network profile.
Runtime-private received-context associations must survive routing with this
identity, including context-only events. An application-created return address
does not establish authenticated or admitted context.

## Existing Nightseam Java boundary

`AddressedWire`, `Receiver` and `Message` are adapted from
[Nightseam at the pinned source revision](https://github.com/Bitspark/nightseam/tree/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f/duplex/java).
The existing Nightseam Java Message uses a `Map<String, Object>` frame and a direct
`Wire` return address under that revision's naming. Bitwire gives those values an explicit profile shape and
return identity wrapper. Adopting this package therefore requires profile
conversion and preserving return wrappers at that boundary; changing imports
alone does not complete adoption. This package does not claim that Nightseam Java
has already migrated.

## Build and check the packaged consumer

From the repository root, with Java 21, Maven 3.9 and Node available:

```sh
mvn -B -ntp -f wire/java/pom.xml verify
node wire/java/check-consumer.mjs
```

Set `MAVEN_CMD` to the full Maven executable path when it is not on `PATH`. The
second command copies the [consumer example](examples/consumer/src/main/java/example/Consumer.java)
outside the checkout, installs the built JAR and POM into a fresh temporary Maven
repository, resolves the example by its coordinates, and executes it. It does not
publish. Unit tests cover the public data model; neither these tests nor the
example establish runtime behavioral conformance.
After publication, `node wire/java/check-consumer.mjs --registry` performs the
same check using only Maven Central resolution in a fresh local repository.

The build creates the binary, sources and Javadoc JARs. Binary and source artifacts
include the Apache-2.0 license and Nightseam attribution. Publishing uses the
`release` profile and requires the `dev.bitspark` namespace to be verified by the
owner of `bitspark.dev`, Central Portal credentials, and a signing key.

The release environment supplies these GitHub Actions secrets:

| Secret | Value |
| --- | --- |
| `MAVEN_CENTRAL_USERNAME` | Central Portal user-token username |
| `MAVEN_CENTRAL_PASSWORD` | Central Portal user-token password |
| `MAVEN_GPG_PRIVATE_KEY` | ASCII-armored private signing key, imported by CI |
| `MAVEN_GPG_PASSPHRASE` | Signing-key passphrase |

[release-settings.xml](release-settings.xml) maps the two Central environment
variables to Maven server id `central`. The GPG plugin reads its passphrase from
`MAVEN_GPG_PASSPHRASE`; the release job must import `MAVEN_GPG_PRIVATE_KEY` before
invoking Maven, for example with `actions/setup-java`. No secret values belong
in the POM or settings file.

From this directory, `mvn -B -ntp -s release-settings.xml -Prelease deploy` signs,
uploads and waits for publication. Run it only as part of the repository's
coordinated release. See the
[Central Maven publisher documentation](https://central.sonatype.org/publish/publish-portal-maven/)
for account and signing setup.

The repository's `publish-java` GitHub Actions workflow performs that publication
for an explicitly selected, already published immutable GitHub release tag. It
requires a public repository and matching POM version, runs the package checks,
then verifies installation from Maven Central. It creates no tag or GitHub release.
