package com.bitspark.bitwire;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Checks the public Java data model; this is not a runtime conformance driver. */
final class ContractTest {
    @Test void payloadsPreservePrecisionAndExplicitNull() {
        String encoded = "{\"big\":9007199254740993,\"precise\":1.0000000000000001,\"empty\":null}";
        ProfileFrame.Request request = new ProfileFrame.Request("r", new JsonValue(encoded));
        assertEquals(encoded, request.params().json());
        assertNull(request.meta());
        assertNull(request.traceparent());
        assertEquals(1, request.version());

        ProfileFrame.Response response = new ProfileFrame.Response("r", new JsonValue("null"));
        assertEquals("null", response.result().json());
        assertNull(response.error());
        assertNull(new ProfileError("invalid", "bad input").data());
        assertEquals("null", new ProfileError("invalid", "bad input", new JsonValue("null")).data().json());
    }

    @Test void responsesCannotConfuseAbsentAndSuccessfulNullResults() {
        ProfileError error = new ProfileError("denied", "not admitted");
        assertThrows(IllegalArgumentException.class,
            () -> new ProfileFrame.Response("r", null, null, null, null));
        assertThrows(IllegalArgumentException.class,
            () -> new ProfileFrame.Response("r", new JsonValue("null"), error, null, null));
        assertSame(error, new ProfileFrame.Response("r", error).error());
    }

    @Test void everyFrameHasAnExplicitProfileKind() {
        List<ProfileFrame> frames = List.of(
            new ProfileFrame.Request("r", new JsonValue("{}")),
            new ProfileFrame.Response("r", new JsonValue("null")),
            new ProfileFrame.Event(new JsonValue("[]")),
            new ProfileFrame.Cancel("r"));
        assertEquals(List.of("request", "response", "event", "cancel"),
            frames.stream().map(frame -> frame.kind().value()).toList());
        assertTrue(frames.stream().allMatch(frame -> frame.version() == 1));
    }

    @Test void metadataCannotChangeAfterConstruction() {
        LinkedHashMap<String, String> meta = new LinkedHashMap<>();
        meta.put("request", "first");
        ProfileFrame.Request request = new ProfileFrame.Request("r", new JsonValue("null"), meta, "parent", "state");
        meta.put("request", "second");
        assertEquals("first", request.meta().get("request"));
        assertThrows(UnsupportedOperationException.class, () -> request.meta().put("new", "value"));
        assertEquals("parent", request.traceparent());
        assertEquals("state", request.tracestate());
    }

    @Test void localReturnCapabilityHasIdentityIndependentOfItsWire() {
        EqualWire endpoint = new EqualWire();
        ReturnAddress first = new ReturnAddress(endpoint);
        ReturnAddress second = new ReturnAddress(endpoint);
        assertNotEquals(first, second);
        assertSame(endpoint, first.wire());
        Message message = new Message(new ProfileFrame.Cancel("r"), first);
        assertSame(first, message.returnAddress());
        assertNull(new Message(message.frame()).returnAddress());
    }

    @Test void consumerCanImplementTheInterfaceWithoutANightseamDependency() {
        RecordingWire endpoint = new RecordingWire();
        List<List<String>> paths = List.of(List.of(), List.of(""), List.of("a/b"), List.of("a", "b"), List.of("\ud83c\udf0c"));
        Message message = new Message(new ProfileFrame.Event(new JsonValue("null")));
        paths.forEach(path -> endpoint.send(path, message));
        assertEquals(paths, endpoint.paths);
        assertEquals(5, endpoint.paths.stream().distinct().count());
        assertTrue(endpoint.messages.stream().allMatch(delivered -> delivered == message));
        assertThrows(IllegalStateException.class, () -> endpoint.receive(List.of(), new Receiver(false, null, null)));
    }

    /** This recording fixture deliberately provides no dispatch implementation. */
    private static final class RecordingWire implements Wire {
        final List<List<String>> paths = new ArrayList<>();
        final List<Message> messages = new ArrayList<>();
        @Override public void send(List<String> path, Message message) {
            paths.add(List.copyOf(path));
            messages.add(message);
        }
        @Override public Runnable receive(List<String> path, Receiver receiver) {
            throw new IllegalStateException("this fixture has no receiving endpoint");
        }
        @Override public void close(int code, String reason) {}
    }

    private static final class EqualWire implements Wire {
        @Override public void send(List<String> path, Message message) {}
        @Override public Runnable receive(List<String> path, Receiver receiver) { return () -> {}; }
        @Override public void close(int code, String reason) {}
        @Override public boolean equals(Object other) { return other instanceof EqualWire; }
        @Override public int hashCode() { return 1; }
    }
}
