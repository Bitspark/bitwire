/**
 * Bitwire access contract, adapted from Nightseam's duplex/ts/src/wire.ts and
 * reviewed at 1c63f1c4d7e4b5987d4bd32e294177645c92ed8f. Implementations provide
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
 * The Send path supplies the method/event name; the frame has no second name.
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
  readonly wire: Wire;
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

/** Receives deliveries relative to its wire's origin, and an ending. */
export interface Receiver {
  /** Capture descendants too; exact routes win, then the longest namespace prefix. */
  namespace?: boolean;
  message?: (path: Path, message: Message) => void | Promise<void>;
  closed?: (code: number, reason: string) => void;
}

/**
 * An endpoint with an origin. Receive registers an exact dispatch path and
 * refuses a duplicate; detach is idempotent. Roots own bounded asynchronous
 * dispatch and carrier closure. Selection and mounting allocate neither peers
 * nor channels, and never invoke destination handlers inside send.
 * Successful send means admission, not completion of an application effect.
 */
export interface Wire {
  send(path: Path, message: Message): void;
  receive(path: Path, receiver: Receiver): () => void;
  close(code?: number, reason?: string): void;
}
