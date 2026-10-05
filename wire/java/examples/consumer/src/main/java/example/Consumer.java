package example;
import dev.bitspark.bitwire.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;
public final class Consumer {
 public static void main(String[] args) {
  Wire sender=message->CompletableFuture.completedFuture(null);
  sender.send(new Atom(new byte[]{(byte)255})).toCompletableFuture().join();
  if(List.of().equals(List.of(new Atom(new byte[0])))) throw new AssertionError();
 }
}
