package dev.bitspark.bitwire;
import java.util.List;
public record Tuple(List<Value> items) implements Value {
  public Tuple { items = List.copyOf(items); }
}
