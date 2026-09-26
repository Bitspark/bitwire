package dev.bitspark.bitwire;

import java.util.List;

/**
 * Transitional send-only relative-path facade, formerly named Wire. It is not
 * a {@link WireTree}: it provides no complete structural access and its paths
 * contain Unicode-scalar strings rather than arbitrary binary keys.
 * This capability grants no receiver
 * attachment or closure authority. Implementations own asynchronous dispatch
 * and bounds; routing policies belong to compositions above this boundary.
 */
public interface AddressedWire {
    /**
     * Admits or refuses a message without awaiting its response or executing a
     * destination application callback on the caller's stack.
     *
     * @param path relative Unicode-scalar path segments, without normalization
     * @param message profile data and optional local return access
     * @throws RuntimeException when admission is refused
     */
    void send(List<String> path, Message message);

}
