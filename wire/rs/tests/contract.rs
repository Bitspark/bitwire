use bitwire::{Atom, Envelope, Value};
#[test]
fn byte_paths_and_unknown_values() {
    let self_path: Vec<Atom> = vec![];
    let empty_child = vec![Atom::new(Vec::new())];
    assert_ne!(self_path, empty_child);
    assert_ne!(
        vec![Atom::new(b"a/b".to_vec())],
        vec![Atom::new(b"a".to_vec()), Atom::new(b"b".to_vec())]
    );
    let e = Envelope {
        source: self_path,
        destination: empty_child,
        id: Atom::new(vec![255]),
        correlation: Some(Atom::new(Vec::new())),
        payload: Value::tuple([Value::atom(vec![0, 255])]),
    };
    assert_ne!(e.correlation, None);
    assert_eq!(e.clone(), e);
}
