package dev.bitspark.bitwire;
import java.util.Arrays;
import java.util.Objects;
public final class Atom implements Value {
  private final byte[] data;
  public Atom(byte[] data) { this.data = Objects.requireNonNull(data).clone(); }
  public byte[] bytes() { return data.clone(); }
  @Override public boolean equals(Object other) { return other instanceof Atom a && Arrays.equals(data,a.data); }
  @Override public int hashCode() { return Arrays.hashCode(data); }
}
