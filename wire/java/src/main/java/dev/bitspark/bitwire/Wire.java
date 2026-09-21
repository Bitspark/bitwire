package dev.bitspark.bitwire;

import java.util.List;

/**
 * Send-only relative access to an origin. This capability grants no receiver
 * attachment or closure authority. Implementations own asynchronous dispatch
 * and bounds; routing policies belong to compositions above this boundary.
 */
public interface Wire {
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
