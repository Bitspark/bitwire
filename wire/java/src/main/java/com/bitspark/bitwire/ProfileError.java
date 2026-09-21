package com.bitspark.bitwire;

import java.util.Objects;

/**
 * Public error data, independent of any runtime exception type.
 *
 * @param code profile error code
 * @param message public explanation
 * @param data optional JSON data; {@code null} means absent, distinct from JSON null
 */
public record ProfileError(String code, String message, JsonValue data) {
    /** Creates public error data. */
    public ProfileError {
        Objects.requireNonNull(code, "code");
        Objects.requireNonNull(message, "message");
    }

    /**
     * Creates an error without additional data.
     *
     * @param code profile error code
     * @param message public explanation
     */
    public ProfileError(String code, String message) { this(code, message, null); }
}
