// The single generic wire contract. Runtime endpoints belong to bitruntime.
import type { Atom, Value } from './ontos/core.js';
export { Atom, Tuple, atom, tuple, equals, isValue } from './ontos/core.js';
export type { Value, BytesLike } from './ontos/core.js';
export { captureEnvelope, encodeEnvelope, decodeEnvelope, pathEqual, pathStartsWith,
  MAX_ENVELOPE_DEPTH, DEFAULT_MAX_ENVELOPE_BYTES, WEBSOCKET_PROTOCOL } from './envelope.js';
export type Path = readonly Atom[];
export interface Envelope {
  readonly source: Path;
  readonly destination: Path;
  readonly id: Atom;
  readonly correlation?: Atom;
  readonly payload: Value;
}
export interface Termination { readonly kind: 'closed' | 'failed'; readonly message?: string }
export interface Wire {
  send(envelope: Envelope): Promise<void>;
  receive(handler: (envelope: Envelope) => void): () => void;
  readonly closed: Promise<Termination>;
  close(): Promise<void>;
}
export type Children<T> = ReadonlyArray<readonly [Atom, DeixisNode<T>]>;
export interface DeixisNode<T> {
  own(): T;
  children(): Children<T>;
  at(path: Path): DeixisNode<T> | undefined;
  decompose(): Readonly<{ own: T; children: Children<T> }>;
}
