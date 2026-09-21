package example;

import com.bitspark.bitwire.JsonValue;
import com.bitspark.bitwire.Message;
import com.bitspark.bitwire.ProfileFrame;
import com.bitspark.bitwire.Receiver;
import com.bitspark.bitwire.ReturnAddress;
import com.bitspark.bitwire.Wire;
import java.util.List;

/** An application can use the public contract without depending on a runtime. */
public final class Consumer {
    private Consumer() {}

    public static void main(String[] args) {
        RecordingWire suppliedByApplication = new RecordingWire();
        Wire wire = suppliedByApplication;
        ReturnAddress returnAddress = new ReturnAddress(wire);
        ProfileFrame.Request frame = new ProfileFrame.Request("example-1", new JsonValue("9007199254740993"));
        Message message = new Message(frame, returnAddress);
        wire.send(List.of("", "cell/value"), message);
        if (!suppliedByApplication.path.equals(List.of("", "cell/value"))
                || suppliedByApplication.message.frame() != frame
                || suppliedByApplication.message.returnAddress() != returnAddress
                || !frame.params().json().equals("9007199254740993")) {
            throw new AssertionError("public contract values did not survive application handoff");
        }
        System.out.println("Bitwire Java packaged consumer passed.");
    }

    /** Admission recording only; a real endpoint supplies asynchronous dispatch. */
    private static final class RecordingWire implements Wire {
        private List<String> path;
        private Message message;

        @Override public void send(List<String> path, Message message) {
            this.path = List.copyOf(path);
            this.message = message;
        }

        @Override public Runnable receive(List<String> path, Receiver receiver) {
            throw new UnsupportedOperationException("the example does not implement receiving");
        }

        @Override public void close(int code, String reason) {}
    }
}
