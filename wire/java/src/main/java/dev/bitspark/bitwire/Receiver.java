package dev.bitspark.bitwire;

import java.util.List;
import java.util.function.BiConsumer;

/**
 * Delivery callbacks; either callback may be absent ({@code null}). Dispatch
 * and handler scheduling belong to the endpoint implementation.
 *
 * @param namespace match descendants as well as the registration path
 * @param message receives a path relative to the registration Wire's origin
 * @param closed receives the endpoint termination code and reason
 */
public record Receiver(boolean namespace, BiConsumer<List<String>, Message> message,
                       BiConsumer<Integer, String> closed) {}
