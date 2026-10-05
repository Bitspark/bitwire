//! Addressless interaction, addressed access and complete structure.
pub mod ontos;
pub use ontos::{Atom, Tuple, Value};
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
pub type Path = Vec<Atom>;
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Termination {
    Closed,
    Failed(String),
}
pub type Completion<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;
pub type Receiver = Arc<dyn Fn(Value) + Send + Sync>;
pub type AddressedReceiver = Arc<dyn Fn(Path, Value) + Send + Sync>;
pub type Detach = Box<dyn Fn() + Send + Sync>;
pub trait Wire: Send + Sync {
    fn send(&self, message: Value) -> Completion<'_, Result<(), String>>;
}
pub trait Endpoint: Wire {
    fn receive(&self, handler: Receiver) -> Result<Detach, String>;
    fn closed(&self) -> Completion<'_, Termination>;
    fn close(&self) -> Completion<'_, ()>;
}
pub trait AddressedWire: Send + Sync {
    fn send(&self, path: Path, message: Value) -> Completion<'_, Result<(), String>>;
}
pub trait AddressedEndpoint: AddressedWire {
    fn receive(&self, handler: AddressedReceiver) -> Result<Detach, String>;
    fn closed(&self) -> Completion<'_, Termination>;
    fn close(&self) -> Completion<'_, ()>;
}
pub type Children<T> = Vec<(Atom, Arc<dyn DeixisNode<T>>)>;
pub struct Parts<T> {
    pub own: T,
    pub children: Children<T>,
}
pub trait DeixisNode<T>: Send + Sync {
    fn own(&self) -> T;
    fn children(&self) -> Children<T>;
    fn at(&self, path: &[Atom]) -> Option<Arc<dyn DeixisNode<T>>>;
    fn decompose(&self) -> Parts<T>;
}
pub type WireTree = dyn DeixisNode<Arc<dyn Wire>>;
