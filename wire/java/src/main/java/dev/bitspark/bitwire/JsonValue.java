package dev.bitspark.bitwire;

import java.util.Objects;

/**
 * Encoded JSON retained verbatim, including large numbers and explicit null.
 * The profile implementation supplies valid JSON and owns validation and codecs;
 * this value performs no parsing and accepts no arbitrary Java object graph.
 *
 * @param json complete encoded JSON value; {@code "null"} is a present JSON null
 */
public record JsonValue(String json) {
    /** Creates a payload without changing its JSON representation. */
    public JsonValue { Objects.requireNonNull(json, "json"); }
}
