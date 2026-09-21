package dev.bitspark.bitwire;

/** Owning endpoint access with one active receive attachment and closure. */
public interface Endpoint extends Wire {
    /**
     * Attaches callbacks for every delivered relative path and complete message.
     * A second active attachment or a closed endpoint is refused. No path
     * matching policy is implied.
     *
     * @param receiver delivery and closure callbacks
     * @return idempotent detach; a stale detach cannot remove a later attachment
     * @throws RuntimeException when attachment is refused, including duplicates
     */
    Runnable receive(Receiver receiver);

    /**
     * Ends this endpoint and notifies its active receiver once. Detached
     * receivers are not notified. Closing twice has no additional effect; endpoint
     * closure is distinct from releasing a live binding. Detaching a receiver
     * does not close this endpoint or invalidate captured return access.
     *
     * @param code profile termination code
     * @param reason termination explanation
     * @throws RuntimeException when closure is refused
     */
    void close(int code, String reason);
}
