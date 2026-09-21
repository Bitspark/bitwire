package dev.bitspark.bitwire;

import java.util.List;

/**
 * Relative access to an origin. The endpoint owns asynchronous dispatch and
 * bounds; a selected view shares endpoint closure, while a mount owns only its
 * routing and registrations, leaving borrowed children usable after closing.
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

    /**
     * Installs a receiver. Exact routes win, otherwise the longest namespace
     * prefix wins. Callback paths are relative to this Wire's origin.
     *
     * @param path exact path, or namespace prefix when requested by the receiver
     * @param receiver callbacks and matching mode
     * @return idempotent detachment preventing new dispatch; already admitted
     *         requests retain their captured return and cancellation access
     * @throws RuntimeException when registration is refused, including duplicates
     */
    Runnable receive(List<String> path, Receiver receiver);

    /**
     * Ends this endpoint according to its ownership and profile. Ending a Wire
     * is distinct from releasing a live binding.
     *
     * @param code profile termination code
     * @param reason termination explanation
     * @throws RuntimeException when closure is refused
     */
    void close(int code, String reason);
}
