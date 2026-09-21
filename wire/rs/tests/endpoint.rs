//! Consumer fixture observations; this is not a routing runtime.
use bitwire::{
    Detach, Endpoint, Message, ProfileFrame, ProfileKind, PublicError, Receiver, ReturnAddress,
    Wire,
};
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct Attachment {
    current: Option<(Arc<()>, Receiver)>,
    closed: bool,
}

#[derive(Default)]
struct RecordingEndpoint {
    attachment: Arc<Mutex<Attachment>>,
}

impl Wire for RecordingEndpoint {
    fn send(&self, _path: &[String], _message: Message) -> Result<(), PublicError> {
        Ok(())
    }
}

impl Endpoint for RecordingEndpoint {
    fn receive(&self, receiver: Receiver) -> Result<Detach, PublicError> {
        let mut attachment = self.attachment.lock().unwrap();
        if attachment.closed {
            return Err(PublicError::new("closed", "endpoint closed"));
        }
        if attachment.current.is_some() {
            return Err(PublicError::new("attached", "receiver already attached"));
        }
        let token = Arc::new(());
        attachment.current = Some((token.clone(), receiver));
        let state = self.attachment.clone();
        Ok(Arc::new(move || {
            let mut state = state.lock().unwrap();
            if state
                .current
                .as_ref()
                .is_some_and(|(current, _)| Arc::ptr_eq(current, &token))
            {
                state.current = None;
            }
        }))
    }

    fn close(&self, code: u16, reason: &str) -> Result<(), PublicError> {
        let receiver = {
            let mut state = self.attachment.lock().unwrap();
            if state.closed {
                return Ok(());
            }
            state.closed = true;
            state.current.take().map(|(_, receiver)| receiver)
        };
        if let Some(callback) = receiver.and_then(|r| r.closed) {
            callback(code, reason.into());
        }
        Ok(())
    }
}

#[test]
fn endpoint_attachment_ownership_and_complete_delivery() {
    let endpoint = RecordingEndpoint::default();
    let observed = Arc::new(Mutex::new(Vec::new()));
    let deliveries = observed.clone();
    let detach = endpoint
        .receive(Receiver::new(move |path, message| {
            deliveries.lock().unwrap().push((path, message));
        }))
        .unwrap();
    assert!(endpoint.receive(Receiver::default()).is_err());
    let returning = Arc::new(ReturnAddress {
        wire: Arc::new(SendAccess),
    });
    let mut message = Message::new(ProfileFrame::new(ProfileKind::Event));
    message.returning = Some(returning.clone());
    message.context = Some(Arc::new("context"));
    let receiver = endpoint
        .attachment
        .lock()
        .unwrap()
        .current
        .as_ref()
        .unwrap()
        .1
        .clone();
    receiver.message.unwrap()(vec!["a".into(), "".into()], message.clone());
    let seen = observed.lock().unwrap();
    assert_eq!(seen[0].0, ["a", ""]);
    assert!(Arc::ptr_eq(
        seen[0].1.returning.as_ref().unwrap(),
        &returning
    ));
    assert!(Arc::ptr_eq(
        seen[0].1.context.as_ref().unwrap(),
        message.context.as_ref().unwrap()
    ));
    detach();
    detach();
    let replacement = endpoint.receive(Receiver::default()).unwrap();
    detach();
    assert!(endpoint.attachment.lock().unwrap().current.is_some());
    replacement();
    assert!(endpoint.attachment.lock().unwrap().current.is_none());
}

// A send-only capability has no dummy receiver or closure implementation.
struct SendAccess;
impl Wire for SendAccess {
    fn send(&self, _path: &[String], _message: Message) -> Result<(), PublicError> {
        Ok(())
    }
}

#[test]
fn closure_notifies_only_active_attachment_once() {
    let endpoint = RecordingEndpoint::default();
    let detached = Receiver {
        closed: Some(Arc::new(|_, _| panic!("detached receiver notified"))),
        ..Receiver::default()
    };
    endpoint.receive(detached).unwrap()();
    let observed = Arc::new(Mutex::new(Vec::new()));
    let endings = observed.clone();
    endpoint
        .receive(Receiver {
            closed: Some(Arc::new(move |code, reason| {
                endings.lock().unwrap().push((code, reason))
            })),
            ..Receiver::default()
        })
        .unwrap();
    endpoint.close(1000, "done").unwrap();
    endpoint.close(1001, "again").unwrap();
    assert_eq!(*observed.lock().unwrap(), [(1000, "done".to_owned())]);
    assert!(endpoint.receive(Receiver::default()).is_err());
}
