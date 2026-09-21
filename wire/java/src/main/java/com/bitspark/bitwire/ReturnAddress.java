package com.bitspark.bitwire;

import java.util.Objects;

/**
 * A local return capability with reference identity independent of Wire equality.
 * Routing preserves this exact object. It is never a serialized envelope field.
 * A runtime may associate received invocation context with this identity,
 * including context-only event delivery; a caller-created address is not proof
 * of authentication or admission.
 */
public final class ReturnAddress {
    private final Wire wire;

    /**
     * Creates return access with a distinct local identity.
     *
     * @param wire endpoint to which the holder may send a reply
     */
    public ReturnAddress(Wire wire) {
        this.wire = Objects.requireNonNull(wire, "wire");
    }

    /**
     * Supplies the endpoint carried by this capability.
     * @return the return endpoint
     */
    public Wire wire() { return wire; }
}
