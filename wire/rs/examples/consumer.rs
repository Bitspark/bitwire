//! A consumer of only the public contract: no Nightseam or async runtime.
use bitwire::{
    AddressedWire, Message, Payload, ProfileFrame, ProfileKind, PublicError, Receiver,
    ReturnAddress, SharedAddressedWire, SharedWire, Wire,
};
use std::sync::Arc;

/// A caller may supply an endpoint which refuses admission. This deliberately
/// provides no dispatch or routing implementation.
struct Unavailable;

impl AddressedWire for Unavailable {
    fn send(&self, _path: &[String], _message: Message) -> Result<(), PublicError> {
        Err(PublicError::new("disconnected", "endpoint unavailable").unpublished())
    }
}

/// The primitive grants addressless sending, independently of legacy carriers.
struct UnavailableOrigin;

impl Wire for UnavailableOrigin {
    fn send(&self, _message: Message) -> Result<(), PublicError> {
        Err(PublicError::new("disconnected", "origin unavailable").unpublished())
    }
}

fn accepts_thread_safe<T: Send + Sync>() {}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    accepts_thread_safe::<Message>();
    accepts_thread_safe::<Receiver>();
    accepts_thread_safe::<SharedAddressedWire>();
    accepts_thread_safe::<SharedWire>();

    let origin: SharedWire = Arc::new(UnavailableOrigin);
    assert!(
        origin
            .send(Message::new(ProfileFrame::new(ProfileKind::Event)))
            .is_err()
    );

    let endpoint: SharedAddressedWire = Arc::new(Unavailable);
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
