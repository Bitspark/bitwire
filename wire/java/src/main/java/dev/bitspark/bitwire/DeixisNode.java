package dev.bitspark.bitwire;
import java.util.List;
import java.util.Optional;
public interface DeixisNode<T> {
  record Child<T>(Atom key, DeixisNode<T> node) {}
  record Parts<T>(T own, List<Child<T>> children) { public Parts { children=List.copyOf(children); } }
  T own();
  List<Child<T>> children();
  Optional<DeixisNode<T>> at(List<Atom> path);
  Parts<T> decompose();
}
