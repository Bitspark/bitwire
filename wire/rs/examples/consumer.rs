//! A consumer of only the public contract: no Nightseam or async runtime.
use bitwire::{
    Message, Payload, ProfileFrame, ProfileKind, PublicError, Receiver, ReturnAddress, SharedWire,
    Wire,
};
use std::sync::Arc;

/// A caller may supply an endpoint which refuses admission. This deliberately
/// provides no dispatch or routing implementation.
struct Unavailable;

impl Wire for Unavailable {
    fn send(&self, _path: &[String], _message: Message) -> Result<(), PublicError> {
        Err(PublicError::new("disconnected", "endpoint unavailable").unpublished())
    }
}

fn accepts_thread_safe<T: Send + Sync>() {}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    accepts_thread_safe::<Message>();
    accepts_thread_safe::<Receiver>();
    accepts_thread_safe::<SharedWire>();

    let endpoint: SharedWire = Arc::new(Unavailable);
    let returning = Arc::new(ReturnAddress {
        wire: endpoint.clone(),
    });
    let mut frame = ProfileFrame::new(ProfileKind::Request);
    frame.id = "r1".into();
    frame.params = Payload::from_json(r#"{"integer":9007199254740993}"#)?;
    let mut message = Message::new(frame);
    message.returning = Some(returning.clone());
    message.context = Some(Arc::new("local application context".to_owned()));

    // A clone represents the same return capability, not a newly allocated one.
    let forwarded = message.clone();
    assert!(Arc::ptr_eq(
        forwarded.returning.as_ref().unwrap(),
        &returning
    ));
    assert!(Arc::ptr_eq(
        forwarded.context.as_ref().unwrap(),
        message.context.as_ref().unwrap(),
    ));
    assert_eq!(
        forwarded.frame.params.raw(),
        Some(r#"{"integer":9007199254740993}"#)
    );

    let refused = endpoint
        .send(&["opaque/segment".into(), "".into()], forwarded)
        .unwrap_err();
    assert!(refused.is_unpublished());
    assert!(!refused.without_unpublished_proof().is_unpublished());
    Ok(())
}
