//! The shared relative-path Wire contract, independent of any runtime.
//!
//! A [`Wire`] admits a message at an opaque relative path. [`Endpoint`] adds
//! one owning receive attachment and endpoint closure. Runtimes own queues, asynchronous dispatch, routing,
//! codecs and carriers; this crate provides none of those implementations.
//!
//! Paths are sequences of Unicode scalar strings. No separator parsing or
//! normalization occurs: `[]`, `[""]`, `["a/b"]` and `["a", "b"]` are distinct.
//! Return capabilities and opaque context are local values, never envelope data.
//!
//! Adapted from Nightseam's `duplex/rs/src/access.rs` at
//! `1c63f1c4d7e4b5987d4bd32e294177645c92ed8f`, under Apache-2.0. Modified to
//! extract the contract without selection, mounting, encoding or runtime code.

mod profile;

pub use profile::{Payload, PublicError, Trace, check_unicode};

use std::{any::Any, collections::BTreeMap, sync::Arc};

/// Fixed version of the logical frame grammar retained by this binding.
///
/// The Rust frame has no mutable version field. A profile codec supplies and
/// validates this version when crossing an encoded boundary.
pub const PROFILE_VERSION: u8 = 1;

/// The four logical frame kinds. Validation and correlation belong to the peer.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProfileKind {
    Request,
    Response,
    Event,
    Cancel,
}

/// A structured profile frame, without an operation name or local capabilities.
///
/// The send path supplies the request method or event name. Absent payload fields
/// are distinct from JSON null. The profile validates fields for each frame kind;
/// this Rust record, like the Go record, does not encode every grammar constraint.
#[derive(Clone, Debug)]
pub struct ProfileFrame {
    pub kind: ProfileKind,
    pub id: String,
    pub params: Payload,
    pub result: Payload,
    pub error: Option<PublicError>,
    pub data: Payload,
    pub trace: Trace,
    pub meta: BTreeMap<String, String>,
}

impl ProfileFrame {
    pub fn new(kind: ProfileKind) -> Self {
        Self {
            kind,
            id: String::new(),
            params: Payload::Absent,
            result: Payload::Absent,
            error: None,
            data: Payload::Absent,
            trace: Trace::default(),
            meta: BTreeMap::new(),
        }
    }
}

/// A local return capability. Preserve the enclosing [`Arc`] when forwarding.
///
/// Identity is tested with [`Arc::ptr_eq`], independently of the implementation's
/// type or equality. This value is deliberately not serializable.
pub struct ReturnAddress {
    pub wire: SharedWire,
}

/// A profile frame with optional local return access and opaque received context.
///
/// Cloning preserves the identity of both local values. Context is owned and
/// interpreted by the profile/runtime; Bitwire neither authenticates nor serializes
/// it. The whole message intentionally implements no serialization trait.
#[derive(Clone)]
pub struct Message {
    pub frame: ProfileFrame,
    pub returning: Option<Arc<ReturnAddress>>,
    pub context: Option<Arc<dyn Any + Send + Sync>>,
}

impl Message {
    pub fn new(frame: ProfileFrame) -> Self {
        Self {
            frame,
            returning: None,
            context: None,
        }
    }
}

/// An idempotent action that detaches one registration, leaving its endpoint open.
pub type Detach = Arc<dyn Fn() + Send + Sync>;
/// Shared access to an endpoint; no executor or carrier is required by this type.
pub type SharedWire = Arc<dyn Wire>;
/// A delivery relative to the origin of the attached endpoint.
pub type Delivery = Arc<dyn Fn(Vec<String>, Message) + Send + Sync>;
/// Notification that access has ended with a profile termination code and reason.
pub type Ending = Arc<dyn Fn(u16, String) + Send + Sync>;

/// Receives deliveries relative to its attached endpoint, and an ending.
#[derive(Clone, Default)]
pub struct Receiver {
    pub message: Option<Delivery>,
    pub closed: Option<Ending>,
}

impl Receiver {
    pub fn new(callback: impl Fn(Vec<String>, Message) + Send + Sync + 'static) -> Self {
        Self {
            message: Some(Arc::new(callback)),
            ..Self::default()
        }
    }
}

/// Send-only access to an origin through an opaque relative path.
///
/// Send completes on admission or refusal, without running destination application
/// code on the sender's stack or awaiting a response. The implementation must
/// preserve message content and local identities. Access grants no receiving or
/// closure authority. Routing policies belong to compositions above this boundary.
pub trait Wire: Send + Sync {
    fn send(&self, path: &[String], message: Message) -> Result<(), PublicError>;
}

/// Owning endpoint access, including one active receive attachment and closure.
///
/// Receive refuses a closed endpoint or a second attachment until the first
/// detaches. Its callbacks receive every delivered relative path and the complete
/// message. Detach is
/// idempotent; a stale detach must not remove a later attachment. Admitted requests
/// retain their captured return and cancellation access. Closure notifies only
/// the active receiver once; detached receivers are not notified. Closing twice
/// has no additional effect; closure is distinct from releasing a live binding.
pub trait Endpoint: Wire {
    fn receive(&self, receiver: Receiver) -> Result<Detach, PublicError>;
    fn close(&self, code: u16, reason: &str) -> Result<(), PublicError>;
}
