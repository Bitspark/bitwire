package dev.bitspark.bitwire;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
final class ContractTest {
 @Test void bytePathsAndValueOwnership() {
  byte[] b={0,(byte)255}; Atom a=new Atom(b); b[0]=1; assertEquals(0,a.bytes()[0]);
  assertNotEquals(List.of(),List.of(new Atom(new byte[0])));
  assertNotEquals(a,new Tuple(List.of()));
  Envelope e=new Envelope(List.of(),List.of(a),a,Optional.empty(),new Tuple(List.of(a)));
  assertFalse(e.correlation().isPresent());
  assertThrows(UnsupportedOperationException.class,()->e.destination().clear());
 }
}
