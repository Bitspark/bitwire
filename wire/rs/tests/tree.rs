//! An independent finite tree fixture, not a production runtime constructor.
use bitwire::{
    Children, DeixisNode, Key, Message, ProfileFrame, ProfileKind, PublicError, SharedWire, Wire,
    WireTree,
};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
struct Node {
    value: SharedWire,
    children: Children<SharedWire>,
}

impl DeixisNode<SharedWire> for Node {
    fn own(&self) -> &SharedWire {
        &self.value
    }

    fn children(&self) -> Children<SharedWire> {
        self.children.clone()
    }

    fn at(&self, path: &[Key]) -> Option<Arc<WireTree>> {
        let mut current: Arc<WireTree> = Arc::new(self.clone());
        for key in path {
            current = current
                .children()
                .into_iter()
                .find(|(name, _)| name == key)?
                .1;
        }
        Some(current)
    }

    fn decompose(&self) -> (&SharedWire, Children<SharedWire>) {
        (&self.value, self.children())
    }
}

struct RefusingWire;
impl Wire for RefusingWire {
    fn send(&self, _: Message) -> Result<(), PublicError> {
        Err(PublicError::new("refused", "unavailable"))
    }
}

#[derive(Default)]
struct RecordingWire(Mutex<Vec<Message>>);
impl Wire for RecordingWire {
    fn send(&self, message: Message) -> Result<(), PublicError> {
        self.0.lock().unwrap().push(message);
        Ok(())
    }
}

fn leaf(value: SharedWire) -> Arc<WireTree> {
    Arc::new(Node {
        value,
        children: vec![],
    })
}

#[test]
fn full_structure_distinguishes_missing_empty_and_binary_keys() {
    let empty = leaf(Arc::new(RefusingWire));
    let binary = leaf(Arc::new(RefusingWire));
    let tree = Node {
        value: Arc::new(RefusingWire),
        children: vec![(vec![], empty.clone()), (vec![255, 0], binary.clone())],
    };
    assert!(Arc::ptr_eq(tree.at(&[]).unwrap().own(), tree.own()));
    assert!(Arc::ptr_eq(&tree.at(&[vec![]]).unwrap(), &empty));
    assert!(Arc::ptr_eq(&tree.at(&[vec![255, 0]]).unwrap(), &binary));
    assert!(tree.at(&[b"missing".to_vec()]).is_none());
    assert!(tree.at(&[vec![], vec![]]).is_none());
    let (own, children) = tree.decompose();
    assert_eq!(
        children
            .iter()
            .map(|(key, _)| key.clone())
            .collect::<Vec<_>>(),
        [vec![], vec![255, 0]]
    );
    let rebuilt = Node {
        value: own.clone(),
        children,
    };
    assert!(Arc::ptr_eq(&rebuilt.at(&[vec![]]).unwrap(), &empty));
    assert!(empty.children().is_empty());
    assert!(
        empty
            .own()
            .send(Message::new(ProfileFrame::new(ProfileKind::Event)))
            .is_err()
    );
}

#[test]
fn derived_send_selects_own_and_preserves_local_context() {
    let root = Arc::new(RecordingWire::default());
    let destination = Arc::new(RecordingWire::default());
    let tree = Node {
        value: root.clone(),
        children: vec![(b"route".to_vec(), leaf(destination.clone()))],
    };
    let mut message = Message::new(ProfileFrame::new(ProfileKind::Event));
    message.context = Some(Arc::new("local context"));
    tree.at(&[b"route".to_vec()])
        .unwrap()
        .own()
        .send(message.clone())
        .unwrap();
    assert!(root.0.lock().unwrap().is_empty());
    let messages = destination.0.lock().unwrap();
    assert!(Arc::ptr_eq(
        messages[0].context.as_ref().unwrap(),
        message.context.as_ref().unwrap()
    ));
}
