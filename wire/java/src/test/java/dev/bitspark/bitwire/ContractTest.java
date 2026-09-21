package dev.bitspark.bitwire;

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
        assertFalse(Endpoint.class.isInstance(endpoint));
    }

    @Test void endpointAttachmentHasExplicitOwnership() {
        RecordingEndpoint endpoint = new RecordingEndpoint();
        List<List<String>> paths = new ArrayList<>();
        List<Message> messages = new ArrayList<>();
        Receiver receiver = new Receiver((path, message) -> {
            paths.add(path);
            messages.add(message);
        }, null);
        Runnable detach = endpoint.receive(receiver);
        assertThrows(IllegalStateException.class, () -> endpoint.receive(receiver));
        Message message = new Message(new ProfileFrame.Event(new JsonValue("null")),
            new ReturnAddress(new RecordingWire()));
        endpoint.receiver.message().accept(List.of("a", ""), message);
        assertEquals(List.of(List.of("a", "")), paths);
        assertSame(message, messages.getFirst());
        detach.run();
        detach.run();
        Receiver second = new Receiver(null, null);
        Runnable secondDetach = endpoint.receive(second);
        detach.run();
        assertSame(second, endpoint.receiver);
        secondDetach.run();
        assertNull(endpoint.receiver);
    }

    @Test void closeNotifiesOnlyActiveAttachmentOnce() {
        RecordingEndpoint endpoint = new RecordingEndpoint();
        List<String> observed = new ArrayList<>();
        endpoint.receive(new Receiver(null, (code, reason) -> observed.add("detached"))).run();
        endpoint.receive(new Receiver(null, (code, reason) -> observed.add(code + ":" + reason)));
        endpoint.close(1000, "done");
        endpoint.close(1001, "again");
        assertEquals(List.of("1000:done"), observed);
        assertThrows(IllegalStateException.class, () -> endpoint.receive(new Receiver(null, null)));
    }

    /** Attachment fixture only; it provides no asynchronous runtime. */
    private static final class RecordingEndpoint implements Endpoint {
        Receiver receiver;
        Object attachment;
        boolean closed;
        @Override public void send(List<String> path, Message message) {}
        @Override public Runnable receive(Receiver next) {
            if (closed) throw new IllegalStateException("endpoint closed");
            if (attachment != null) throw new IllegalStateException("receiver already attached");
            Object token = new Object();
            attachment = token;
            receiver = next;
            return () -> {
                if (attachment == token) {
                    attachment = null;
                    receiver = null;
                }
            };
        }
        @Override public void close(int code, String reason) {
            if (closed) return;
            closed = true;
            Receiver active = receiver;
            receiver = null;
            attachment = null;
            if (active != null && active.closed() != null) active.closed().accept(code, reason);
        }
    }

    /** This recording fixture deliberately provides no dispatch implementation. */
    private static final class RecordingWire implements Wire {
        final List<List<String>> paths = new ArrayList<>();
        final List<Message> messages = new ArrayList<>();
        @Override public void send(List<String> path, Message message) {
            paths.add(List.copyOf(path));
            messages.add(message);
        }

    }

    private static final class EqualWire implements Wire {
        @Override public void send(List<String> path, Message message) {}
        @Override public boolean equals(Object other) { return other instanceof EqualWire; }
        @Override public int hashCode() { return 1; }
    }
}
