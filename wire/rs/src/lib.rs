//! The single generic envelope wire; endpoint implementations belong to bitruntime.
pub mod ontos;
pub use ontos::{Atom, Tuple, Value};
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
pub type Path = Vec<Atom>;
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Envelope {
    pub source: Path,
    pub destination: Path,
    pub id: Atom,
    pub correlation: Option<Atom>,
    pub payload: Value,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Termination {
    Closed,
    Failed(String),
}
pub type Completion<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;
pub type Receiver = Arc<dyn Fn(Envelope) + Send + Sync>;
pub type Detach = Box<dyn Fn() + Send + Sync>;
pub trait Wire: Send + Sync {
    fn send(&self, envelope: Envelope) -> Completion<'_, Result<(), String>>;
    fn receive(&self, handler: Receiver) -> Result<Detach, String>;
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
