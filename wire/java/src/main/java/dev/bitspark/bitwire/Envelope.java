package dev.bitspark.bitwire;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
public record Envelope(List<Atom> source, List<Atom> destination, Atom id, Optional<Atom> correlation, Value payload) {
  public Envelope { source=List.copyOf(source); destination=List.copyOf(destination); Objects.requireNonNull(id); Objects.requireNonNull(correlation); Objects.requireNonNull(payload); }
}
