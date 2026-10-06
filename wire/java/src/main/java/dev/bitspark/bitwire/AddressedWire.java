package dev.bitspark.bitwire;
import java.util.List;
import java.util.concurrent.CompletionStage;
public interface AddressedWire { CompletionStage<Void> send(List<Atom> path, Value message); }
