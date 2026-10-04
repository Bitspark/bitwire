package example;
import dev.bitspark.bitwire.*;
import java.util.*;
public final class Consumer {
 public static void main(String[] args) {
  Envelope e=new Envelope(List.of(),List.of(new Atom(new byte[]{(byte)255})),new Atom(new byte[0]),Optional.empty(),new Tuple(List.of()));
  if(e.destination().isEmpty()) throw new AssertionError();
 }
}
