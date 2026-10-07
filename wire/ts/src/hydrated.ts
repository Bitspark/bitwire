// Public live interaction contracts. Construction and recognition belong to runtimes.
import type { Atom } from './ontos/core.js';
import type { Termination } from './index.js';

/** Composition-established arrival context; never carried inside the value. */
export type ReceivedContext = unknown;
/** Finite immutable tuples, exact atoms and opaque sending capabilities. */
export type HydratedValue = Atom | HydratedTuple | HydratedWire;
/** Ground Ontos Tuple already satisfies this view. Runtime factories capture items. */
export interface HydratedTuple {
  readonly kind: 'tuple';
  readonly length: number;
  items(): readonly HydratedValue[];
  at(index: number): HydratedValue | undefined;
}
/** Local admission only. The discriminant is a type distinction, not proof of authority. */
export interface HydratedWire {
  readonly kind: 'wire';
  send(message: HydratedValue): Promise<void>;
}
/** An owner. A conveyed endpoint is projected to wire, including on local delivery. */
export interface HydratedEndpoint extends HydratedWire {
  readonly wire: HydratedWire;
  receive(handler: (message: HydratedValue, context: ReceivedContext) => void): () => void;
  readonly closed: Promise<Termination>;
  close(): Promise<void>;
}
