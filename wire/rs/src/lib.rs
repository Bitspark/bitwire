//! Addressless [`Wire`], full [`WireTree`] structure, and compatibility access.
//!
//! An [`AddressedWire`] admits a message at an opaque relative path. [`Endpoint`] adds
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

/// Exact arbitrary bytes; empty keys are valid and no UTF-8 conversion applies.
pub type Key = Vec<u8>;
/// Structural paths preserve every byte in every segment.
pub type TreePath = Vec<Key>;
/// The complete, unique-key child collection; enumeration order is not semantic.
pub type Children<T> = Vec<(Key, Arc<dyn DeixisNode<T>>)>;

/// A complete finite acyclic tree with one own value at every node.
///
/// `at(&[])` selects this node. Missing children return `None`, never the parent
/// value. `children` and `decompose` expose every exact byte key and retain the
/// payload and child identities. They must not conceal an opaque addressed
/// facade as a complete tree. Constructors and derived operators belong to
/// runtimes; these declarations do not implement routing or tree storage.
pub trait DeixisNode<T>: Send + Sync {
    fn own(&self) -> &T;
    fn children(&self) -> Children<T>;
    fn at(&self, path: &[Key]) -> Option<Arc<dyn DeixisNode<T>>>;
    fn decompose(&self) -> (&T, Children<T>);
}

/// Addressless interaction access stored as the own value of a tree node.
pub type SharedWire = Arc<dyn Wire>;
/// Structured interaction uses precisely the generic structural contract.
pub type WireTree = dyn DeixisNode<SharedWire>;

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
    pub wire: SharedAddressedWire,
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
/// Compatibility access for an addressed endpoint in the unchanged bitwire/1 profile.
pub type SharedAddressedWire = Arc<dyn AddressedWire>;
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

/// Addressless send access, without receiver attachment or closure authority.
///
/// Sending completes on admission or refusal, not application completion. It
/// does not invoke destination application code on the sender's stack. A tree
/// sends by selecting a node, obtaining its own Wire, then sending this message.
pub trait Wire: Send + Sync {
    fn send(&self, message: Message) -> Result<(), PublicError>;
}

/// Compatibility send access through the bitwire/1 profile's relative paths.
///
/// Send completes on admission or refusal, without running destination application
/// code on the sender's stack or awaiting a response. The implementation must
/// preserve message content and local identities. Access grants no receiving or
/// closure authority. Routing policies belong to compositions above this boundary.
pub trait AddressedWire: Send + Sync {
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
pub trait Endpoint: AddressedWire {
    fn receive(&self, receiver: Receiver) -> Result<Detach, PublicError>;
    fn close(&self, code: u16, reason: &str) -> Result<(), PublicError>;
}
