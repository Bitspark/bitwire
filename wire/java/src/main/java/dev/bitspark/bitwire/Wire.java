package dev.bitspark.bitwire;

/**
 * Addressless sending capability held by a {@link WireTree} node. A Wire grants
 * neither receiver attachment nor endpoint closure. Implementations own
 * asynchronous dispatch and admission bounds.
 */
@FunctionalInterface
public interface Wire {
    /**
     * Admits or refuses one message without awaiting application completion or
     * executing a destination application callback on the caller's stack.
     *
     * @param message profile data and optional local return access
     * @throws RuntimeException when admission is refused
     */
    void send(Message message);
}
