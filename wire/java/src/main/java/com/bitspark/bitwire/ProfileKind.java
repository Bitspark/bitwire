package com.bitspark.bitwire;

/** The four logical frame kinds in the initial profile. */
public enum ProfileKind {
    /** A request whose method is the Wire path. */
    REQUEST("request"),
    /** A successful or failed response. */
    RESPONSE("response"),
    /** An event whose name is the Wire path. */
    EVENT("event"),
    /** Cancellation of a correlated request. */
    CANCEL("cancel");

    private final String value;

    ProfileKind(String value) { this.value = value; }

    /**
     * Supplies the exact logical profile spelling.
     * @return the profile kind text
     */
    public String value() { return value; }
}
