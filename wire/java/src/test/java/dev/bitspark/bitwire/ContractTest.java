package dev.bitspark.bitwire;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
final class ContractTest {
 @Test void recursiveHydratedSurface() {
  HydratedWire sender=message->CompletableFuture.completedFuture(null);
  HydratedValue ground=new Tuple(List.of(new Atom(new byte[]{0,(byte)255})));
  sender.send(ground).toCompletableFuture().join();
  sender.send(sender).toCompletableFuture().join();
  assertFalse(sender instanceof HydratedEndpoint);
 }
 @Test void addresslessSenderAndValueOwnership() {
  byte[] b={0,(byte)255}; Atom a=new Atom(b); b[0]=1; assertEquals(0,a.bytes()[0]);
  assertNotEquals(List.of(),List.of(new Atom(new byte[0])));
  assertNotEquals(a,new Tuple(List.of()));
  Wire sender=message->CompletableFuture.completedFuture(null);
  sender.send(a).toCompletableFuture().join();
 }
}
