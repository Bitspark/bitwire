package dev.bitspark.bitwire;
import java.util.concurrent.CompletionStage;
import java.util.function.BiConsumer;
/** Receive and lifetime owner. Only wire() is conveyed in a hydrated message. */
public interface HydratedEndpoint extends HydratedWire {
  HydratedWire wire();
  Runnable receive(BiConsumer<HydratedValue, Object> handler);
  CompletionStage<Termination> closed();
  CompletionStage<Void> close();
}
