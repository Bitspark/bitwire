/**
 * The Bitwire access contract, independent of dispatch, codecs and carriers.
 *
 * <p>Paths are sequences of Unicode-scalar strings. A path has no separator
 * syntax or normalization: the empty path, one empty segment, one segment
 * containing a slash and two separate segments are distinct. Implementations
 * must reject malformed paths and preserve profile data and local return
 * identity through composition.
 *
 * <p>These declarations provide no implementation of selection, mounting,
 * forwarding, asynchronous dispatch or live-reference ownership. The message
 * vocabulary follows {@code nightseam.duplex/1}; identity and reference checks
 * remain explicit obligations of that profile.
 */
package dev.bitspark.bitwire;
