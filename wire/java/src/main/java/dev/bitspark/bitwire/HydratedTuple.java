package dev.bitspark.bitwire;
import java.util.List;
/** Runtime construction captures items and canonicalizes wholly ground tuples. */
public non-sealed interface HydratedTuple extends HydratedValue {
  List<HydratedValue> items();
}
