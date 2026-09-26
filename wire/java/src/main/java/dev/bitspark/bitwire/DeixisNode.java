package dev.bitspark.bitwire;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * The complete structural contract shared by data and interaction trees.
 *
 * <p>Every node has an own value and a complete finite child map. Keys are exact
 * arbitrary bytes, compared by content without text decoding or normalization.
 * Children contain no duplicate keys. The whole structure is finite and acyclic;
 * shared subtrees are permitted. Implementations preserve these obligations and
 * protect the structure from mutations of supplied or returned collections.
 *
 * <p>Selection at an empty path selects this node. A path containing one empty
 * byte array selects its empty-key child, if present. Missing nodes differ from
 * present childless nodes, including nodes whose own capability always refuses.
 * Selecting successively by a then b is equivalent to selecting by a ++ b.
 * Recomposition from {@link #decompose()} preserves own-value identity and the
 * complete child map. Constructors, selection and recomposition implementations
 * belong to runtimes; this package declares their contract only.
 *
 * @param <T> the value or capability held by every node
 */
public interface DeixisNode<T> {
    /**
     * Supplies this node's own value.
     * @return the own value, which is present even on a childless node
     */
    T own();

    /**
     * Returns the complete child map as entries with unique byte-content keys.
     * Entry order carries no structural meaning.
     *
     * @return immutable snapshot of every child entry
     */
    List<Child<T>> children();

    /**
     * Selects a subtree by exact binary keys; it does not bind an unchecked prefix.
     *
     * @param path sequence of arbitrary byte-array keys
     * @return selected node, or empty when an edge is missing
     */
    Optional<DeixisNode<T>> at(List<byte[]> path);

    /**
     * Decomposes this node without losing its structure.
     * @return the own value and complete children required for recomposition
     */
    Parts<T> decompose();

    /**
     * A child-map entry. Keys are copied on input and output. Equality of keys
     * in the structural contract is byte-content equality, not array identity
     * or this record's generated equality operation.
     *
     * @param <T> own-value type
     * @param key exact binary child key
     * @param node child subtree
     */
    record Child<T>(byte[] key, DeixisNode<T> node) {
        /**
         * Creates a structural entry, defensively copying its key.
         * @param key exact binary key
         * @param node child subtree
         */
        public Child {
            key = Objects.requireNonNull(key, "key").clone();
            Objects.requireNonNull(node, "node");
        }

        /**
         * Supplies the exact key without granting mutation of this entry.
         * @return a copy of the exact binary key
         */
        @Override public byte[] key() { return key.clone(); }
    }

    /**
     * Complete decomposition, with an immutable child-entry snapshot. Structural
     * implementations must enforce unique keys and finite acyclic children.
     *
     * @param <T> own-value type
     * @param own node's own value
     * @param children complete child map
     */
    record Parts<T>(T own, List<Child<T>> children) {
        /**
         * Creates a parts value without constructing or routing a tree.
         * @param own node's own value
         * @param children complete child map
         */
        public Parts {
            Objects.requireNonNull(own, "own");
            children = List.copyOf(children);
        }
    }
}
