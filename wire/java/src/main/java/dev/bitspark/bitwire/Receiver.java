package dev.bitspark.bitwire;

import java.util.List;
import java.util.function.BiConsumer;

/**
 * Delivery callbacks; either callback may be absent ({@code null}). Dispatch
 * and handler scheduling belong to the endpoint implementation.
 *
 * @param message receives a path relative to the attached endpoint's origin
 * @param closed receives the endpoint termination code and reason
 */
public record Receiver(BiConsumer<List<String>, Message> message,
                       BiConsumer<Integer, String> closed) {}
