"""Generic envelope wire declarations; runtime implementations belong to bitruntime."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Callable, Protocol, TypeVar, Generic
from .ontos import Atom, Tuple, Value, atom, tuple_, equals
Path = tuple[Atom, ...]
@dataclass(frozen=True)
class Envelope:
    source: Path
    destination: Path
    id: Atom
    payload: Value
    correlation: Atom | None = None
    def __post_init__(self) -> None:
        object.__setattr__(self, 'source', tuple(self.source))
        object.__setattr__(self, 'destination', tuple(self.destination))
        if any(not isinstance(key, Atom) for key in self.source + self.destination):
            raise TypeError('path keys must be atoms')
        if not isinstance(self.id, Atom) or (self.correlation is not None and not isinstance(self.correlation, Atom)):
            raise TypeError('IDs must be atoms')
        if not isinstance(self.payload, (Atom, Tuple)):
            raise TypeError('payload must be a ground value')
@dataclass(frozen=True)
class Termination:
    kind: str
    message: str | None = None
class Wire(Protocol):
    async def send(self, envelope: Envelope) -> None: ...
    def receive(self, handler: Callable[[Envelope], None]) -> Callable[[], None]: ...
    async def closed(self) -> Termination: ...
    async def close(self) -> None: ...
T = TypeVar('T')
@dataclass(frozen=True)
class Parts(Generic[T]):
    own: T
    children: tuple[tuple[Atom, DeixisNode[T]], ...]
class DeixisNode(Protocol[T]):
    def own(self) -> T: ...
    def children(self) -> tuple[tuple[Atom, DeixisNode[T]], ...]: ...
    def at(self, path: Path) -> DeixisNode[T] | None: ...
    def decompose(self) -> Parts[T]: ...
__all__ = ['Atom', 'Tuple', 'Value', 'atom', 'tuple_', 'equals', 'Path', 'Envelope', 'Termination', 'Wire', 'Parts', 'DeixisNode']
