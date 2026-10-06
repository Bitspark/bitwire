use bitwire::{Atom, Path, Value};
fn main() {
    let path: Path = vec![Atom::new(Vec::new())];
    assert_ne!(path, Vec::<Atom>::new());
    assert_ne!(Value::atom(Vec::new()), Value::tuple([]));
}
