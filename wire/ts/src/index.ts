/**
 * Bitwire 0.3 primitive, tree and addressed carrier contracts. Implementations provide
 * dispatch, codecs and carriers; this module declares only the shared boundary.
 */

/**
 * A relative path of Unicode-scalar strings, with no normalization or
 * interpretation of dots, slashes or empty segments.
 */
export type Path = readonly string[];

interface TracedFrame {
  readonly version: 1;
  readonly traceparent?: string;
  readonly tracestate?: string;
}

/**
 * Public error data, without a dependency on a runtime error class. These fields
 * do not prove that a failed send was never published; any such local evidence
 * belongs to the admitting runtime.
 */
export interface ProfileError {
  readonly code: string;
  readonly message: string;
  readonly data?: unknown;
}

/**
 * The AddressedWire path supplies the method/event name; the frame has no second name.
 * Payloads follow the JSON profile: unknown does not imply arbitrary JavaScript
 * values are serializable, or that number preserves arbitrary JSON precision.
 * Required payloads must be present JSON values: null is distinct from absence,
 * and undefined is not a JSON value. Validation belongs to the profile boundary.
 */
export type ProfileFrame = TracedFrame &
  (
    | {
        readonly kind: 'request';
        readonly id: string;
        readonly params: unknown;
        readonly meta?: Readonly<Record<string, string>>;
      }
    | ({ readonly kind: 'response'; readonly id: string } & (
        { readonly result: unknown; readonly error?: never } | { readonly error: ProfileError; readonly result?: never }
      ))
    | { readonly kind: 'event'; readonly data: unknown; readonly meta?: Readonly<Record<string, string>> }
    | { readonly kind: 'cancel'; readonly id: string }
  );

/** The four frame kinds carried by the profile. */
export type ProfileKind = ProfileFrame['kind'];

/**
 * Local capability identity and its runtime-owned context survive routing; this
 * object is never an envelope member. A runtime may associate an event's received
 * context with it without providing a callable reply or a response waiter.
 */
export interface ReturnAddress {
  readonly wire: AddressedWire;
}

/**
 * A profile frame and its local capability, preserved through routing along with
 * runtime-associated received context. Context is not inferred from caller data
 * or metadata. Contents remain immutable after admission; a runtime may retain
 * them. Structural copies must also preserve any private runtime associations.
 */
export interface Message {
  readonly frame: ProfileFrame;
  readonly return?: ReturnAddress;
}

/**
 * Receives complete deliveries relative to its endpoint's origin, and an ending.
 * Path dispatch policy belongs to a composed dispatcher, not this receiver.
 */
export interface Receiver {
  message?: (path: Path, message: Message) => void | Promise<void>;
  closed?: (code: number, reason: string) => void;
}

/**
 * Send access to an origin, without receive attachment or lifecycle control.
 * Send never invokes destination handlers on the sender's stack or waits for
 * their results. The implementing endpoint owns asynchronous dispatch.
 * Successful send means admission, not completion of an application effect.
 */
export interface AddressedWire {
  send(path: Path, message: Message): void;
}

/**
 * Send access, receive attachment and lifecycle control combined. Receive
 * attaches one owning receiver for every relative path; a second attachment
 * is refused until the first is detached. Detach is idempotent and does not
 * close the endpoint. Sharing among selected views requires an explicit
 * composition that defines dispatch policy.
 */
export interface Endpoint extends AddressedWire {
  receive(receiver: Receiver): () => void;
  close(code?: number, reason?: string): void;
}

/** Addressless sending access; completion means admission or refusal, not an application result. */
export interface Wire {
  send(message: Message): void;
}

/** Exact byte key; empty keys and arbitrary binary bytes are valid. */
export type Key = Uint8Array;
/** Structural path, distinct from the bitwire/1 carrier's Unicode string Path. */
export type TreePath = readonly Key[];
export type Child<T> = readonly [Key, DeixisNode<T>];
export interface Parts<T> {
  readonly own: T;
  readonly children: ReadonlyArray<Child<T>>;
}

/**
 * Full finite, acyclic structure with stable own-value associations and a complete
 * byte-keyed child map. Implementations protect mutable keys with copies.
 * The empty path selects self; a missing path returns undefined, never a proxy.
 * Reconstruction from decompose() preserves structure and payload capability
 * identity. Constructors and derived operations belong to the runtime.
 */
export interface DeixisNode<T> {
  own(): T;
  children(): ReadonlyArray<Child<T>>;
  at(path: TreePath): DeixisNode<T> | undefined;
  decompose(): Parts<T>;
}

/** Structured interaction. An arbitrary AddressedWire is not a WireTree. */
export type WireTree = DeixisNode<Wire>;
