package dev.bitspark.bitwire;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
public interface Wire {
  CompletionStage<Void> send(Envelope envelope);
  Runnable receive(Consumer<Envelope> handler);
  CompletionStage<Termination> closed();
  CompletionStage<Void> close();
}
