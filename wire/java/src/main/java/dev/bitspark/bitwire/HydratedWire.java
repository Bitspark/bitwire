package dev.bitspark.bitwire;
import java.util.concurrent.CompletionStage;
/** Send-only capability. Successful completion means local admission. */
public non-sealed interface HydratedWire extends HydratedValue {
  CompletionStage<Void> send(HydratedValue message);
}
