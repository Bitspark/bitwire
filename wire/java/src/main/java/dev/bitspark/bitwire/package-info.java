/**
 * The Bitwire access contract, independent of dispatch, codecs and carriers.
 *
 * <p>{@link dev.bitspark.bitwire.Wire} sends without a path. A
 * {@link dev.bitspark.bitwire.WireTree} is a complete finite acyclic
 * {@link dev.bitspark.bitwire.DeixisNode} structure of Wire capabilities,
 * with exact binary child keys and partial subtree selection.
 *
 * <p>The transitional {@link dev.bitspark.bitwire.AddressedWire} facade retains
 * paths as sequences of Unicode-scalar strings. A path has no separator
 * syntax or normalization: the empty path, one empty segment, one segment
 * containing a slash and two separate segments are distinct. Implementations
 * must reject malformed paths and preserve profile data and local return
 * identity through composition.
 *
 * <p>These declarations provide no implementation of selection, mounting,
 * forwarding, asynchronous dispatch or live-reference ownership. The message
 * vocabulary follows {@code bitwire/1} (historical alias
 * {@code nightseam.duplex/1}); identity and reference checks
 * remain explicit obligations of that profile.
 */
package dev.bitspark.bitwire;
