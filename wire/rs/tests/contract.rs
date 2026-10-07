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

#[test]
fn hydrated_native_surface_is_recursive() {
    use bitwire::{HydratedValue, HydratedWire};
    struct Live;
    impl HydratedWire for Live {
        fn send(&self, _message: HydratedValue) -> Completion<'_, Result<(), String>> {
            Box::pin(async { Ok(()) })
        }
    }
    let wire: std::sync::Arc<dyn HydratedWire> = std::sync::Arc::new(Live);
    drop(wire.send(HydratedValue::Wire(wire.clone())));
    drop(wire.send(HydratedValue::Ground(Value::tuple(vec![]))));
}
