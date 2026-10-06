use bitwire::{Atom, Completion, Value, Wire};
struct SendOnly;
impl Wire for SendOnly {
    fn send(&self, _message: Value) -> Completion<'_, Result<(), String>> {
        Box::pin(async { Ok(()) })
    }
}
#[test]
fn addressless_sender_and_exact_paths() {
    let self_path: Vec<Atom> = vec![];
    assert_ne!(self_path, vec![Atom::new(Vec::new())]);
    assert_ne!(
        vec![Atom::new(b"a/b".to_vec())],
        vec![Atom::new(b"a".to_vec()), Atom::new(b"b".to_vec())]
    );
    let sender: &dyn Wire = &SendOnly;
    drop(sender.send(Value::atom(vec![0, 255])));
}
