/**
 * Bitwire 0.2 access contract. Implementations provide
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
export interface Wire {
  send(path: Path, message: Message): void;
}

/**
 * Send access, receive attachment and lifecycle control combined. Receive
 * attaches one owning receiver for every relative path; a second attachment
 * is refused until the first is detached. Detach is idempotent and does not
 * close the endpoint. Sharing among selected views requires an explicit
 * composition that defines dispatch policy.
 */
export interface Endpoint extends Wire {
  receive(receiver: Receiver): () => void;
  close(code?: number, reason?: string): void;
}
