use bitwire::{Envelope, Path, Value};
fn main() {
    let path: Path = vec![empty_atom()];
    let e = Envelope {
        source: vec![],
        destination: path,
        id: empty_atom(),
        correlation: None,
        payload: Value::tuple([]),
    };
    assert_ne!(e.source, e.destination);
    assert!(e.payload.is_tuple());
}
fn empty_atom() -> bitwire::Atom {
    bitwire::Atom::new(Vec::new())
}
