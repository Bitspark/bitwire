package dev.bitspark.bitwire;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
public interface Endpoint extends Wire {
  Runnable receive(Consumer<Value> handler);
  CompletionStage<Termination> closed();
  CompletionStage<Void> close();
}
