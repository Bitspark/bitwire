// Layered interaction contracts. Runtime implementations belong to bitruntime.
import type { Atom, Value } from './ontos/core.js';
export { Atom, Tuple, atom, tuple, equals, isValue } from './ontos/core.js';
export type { Value, BytesLike } from './ontos/core.js';
export { encodeMessage, decodeMessage, packAddressed, unpackAddressed, capturePath, pathEqual, pathStartsWith,
  MAX_MESSAGE_DEPTH, DEFAULT_MAX_MESSAGE_BYTES, WEBSOCKET_PROTOCOL } from './message.js';
export type Path = readonly Atom[];
export interface Termination { readonly kind: 'closed' | 'failed'; readonly message?: string }
export interface Wire {
  send(message: Value): Promise<void>;
}
export interface Endpoint extends Wire {
  receive(handler: (message: Value) => void): () => void;
  readonly closed: Promise<Termination>;
  close(): Promise<void>;
}
export interface AddressedWire {
  send(path: Path, message: Value): Promise<void>;
}
export interface AddressedEndpoint extends AddressedWire {
  receive(handler: (path: Path, message: Value) => void): () => void;
  readonly closed: Promise<Termination>;
  close(): Promise<void>;
}
export type WireNode = DeixisNode<Wire>;
export type Children<T> = ReadonlyArray<readonly [Atom, DeixisNode<T>]>;
export interface DeixisNode<T> {
  own(): T;
  children(): Children<T>;
  at(path: Path): DeixisNode<T> | undefined;
  decompose(): Readonly<{ own: T; children: Children<T> }>;
}
export type { HydratedValue, HydratedTuple, HydratedWire, HydratedEndpoint, ReceivedContext } from './hydrated.js';
