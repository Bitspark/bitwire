package dev.bitspark.bitwire;

import java.util.Objects;

/**
 * Profile data and local return access, both preserved through routing.
 *
 * @param frame profile frame; the AddressedWire path supplies the method or event name
 * @param returnAddress optional local capability, or {@code null} when absent
 */
public record Message(ProfileFrame frame, ReturnAddress returnAddress) {
    /** Creates a message, retaining the exact frame and return capability. */
    public Message { Objects.requireNonNull(frame, "frame"); }

    /**
     * Creates a message without return access.
     *
     * @param frame profile data
     */
    public Message(ProfileFrame frame) { this(frame, null); }
}
