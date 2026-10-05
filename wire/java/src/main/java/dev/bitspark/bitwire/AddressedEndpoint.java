package dev.bitspark.bitwire;
import java.util.List;
import java.util.concurrent.CompletionStage;
import java.util.function.BiConsumer;
public interface AddressedEndpoint extends AddressedWire {
  Runnable receive(BiConsumer<List<Atom>, Value> handler);
  CompletionStage<Termination> closed();
  CompletionStage<Void> close();
}
