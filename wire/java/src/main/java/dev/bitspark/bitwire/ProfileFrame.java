package dev.bitspark.bitwire;

import java.util.Map;
import java.util.Objects;

/**
 * Logical profile data. Request methods and event names come solely from the
 * Wire path. Correlation, physical encoding and trace validation belong to the
 * profile implementation.
 */
public sealed interface ProfileFrame {
    /**
     * Identifies the initial logical profile version.
     * @return profile version 1
     */
    default int version() { return 1; }

    /**
     * Identifies the logical frame kind.
     * @return the frame kind
     */
    ProfileKind kind();

    /**
     * Supplies the optional trace-parent field.
     * @return trace-parent text, or {@code null} when absent
     */
    String traceparent();

    /**
     * Supplies the optional trace-state field.
     * @return trace-state text, or {@code null} when absent
     */
    String tracestate();

    /**
     * A request at the Wire path.
     *
     * @param id correlation identifier
     * @param params present JSON parameters, including JSON null when appropriate
     * @param meta optional string metadata, or {@code null} when absent
     * @param traceparent optional trace-parent field
     * @param tracestate optional trace-state field
     */
    record Request(String id, JsonValue params, Map<String, String> meta,
                   String traceparent, String tracestate) implements ProfileFrame {
        /** Creates a request, retaining JSON representation and copying metadata. */
        public Request {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(params, "params");
            if (meta != null) meta = Map.copyOf(meta);
        }

        /**
         * Creates a request without metadata or tracing fields.
         * @param id correlation identifier
         * @param params present JSON parameters
         */
        public Request(String id, JsonValue params) { this(id, params, null, null, null); }

        @Override public ProfileKind kind() { return ProfileKind.REQUEST; }
    }

    /**
     * Exactly one response outcome. A present JSON null result is represented by
     * {@code new JsonValue("null")}; a Java null result means no success value.
     *
     * @param id correlation identifier
     * @param result successful JSON result, absent when error is supplied
     * @param error public failure, absent when result is supplied
     * @param traceparent optional trace-parent field
     * @param tracestate optional trace-state field
     */
    record Response(String id, JsonValue result, ProfileError error,
                    String traceparent, String tracestate) implements ProfileFrame {
        /** Creates a response with exactly one success or failure outcome. */
        public Response {
            Objects.requireNonNull(id, "id");
            if ((result == null) == (error == null)) {
                throw new IllegalArgumentException("response requires exactly one of result and error");
            }
        }

        /**
         * Creates a successful response without tracing fields.
         * @param id correlation identifier
         * @param result present JSON result
         */
        public Response(String id, JsonValue result) { this(id, result, null, null, null); }

        /**
         * Creates a failed response without tracing fields.
         * @param id correlation identifier
         * @param error public failure
         */
        public Response(String id, ProfileError error) { this(id, null, error, null, null); }

        @Override public ProfileKind kind() { return ProfileKind.RESPONSE; }
    }

    /**
     * An event at the Wire path.
     *
     * @param data present JSON event payload
     * @param meta optional string metadata, or {@code null} when absent
     * @param traceparent optional trace-parent field
     * @param tracestate optional trace-state field
     */
    record Event(JsonValue data, Map<String, String> meta,
                 String traceparent, String tracestate) implements ProfileFrame {
        /** Creates an event, retaining JSON representation and copying metadata. */
        public Event {
            Objects.requireNonNull(data, "data");
            if (meta != null) meta = Map.copyOf(meta);
        }

        /**
         * Creates an event without metadata or tracing fields.
         * @param data present JSON event payload
         */
        public Event(JsonValue data) { this(data, null, null, null); }

        @Override public ProfileKind kind() { return ProfileKind.EVENT; }
    }

    /**
     * Cancellation of a request.
     *
     * @param id correlation identifier
     * @param traceparent optional trace-parent field
     * @param tracestate optional trace-state field
     */
    record Cancel(String id, String traceparent, String tracestate) implements ProfileFrame {
        /** Creates a cancellation. */
        public Cancel { Objects.requireNonNull(id, "id"); }

        /**
         * Creates a cancellation without tracing fields.
         * @param id correlation identifier
         */
        public Cancel(String id) { this(id, null, null); }

        @Override public ProfileKind kind() { return ProfileKind.CANCEL; }
    }
}
