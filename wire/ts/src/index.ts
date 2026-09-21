/**
 * Draft Bitwire contract, adapted from Nightseam's duplex/ts/src/wire.ts at
 * commit 5217cc60fdf8dd8d6b88e7ebb15bfcc98bb1d515. Implementations provide
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

/** Public error data, without a dependency on a runtime error class. */
export interface ProfileError {
  readonly code: string;
  readonly message: string;
  readonly data?: unknown;
}

/**
 * The Send path supplies the method/event name; the frame has no second name.
 * Payloads follow the JSON profile: unknown does not imply arbitrary JavaScript
 * values are serializable, or that number preserves arbitrary JSON precision.
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

/** Local identity preserved through composition; never an envelope member. */
export interface ReturnAddress {
  readonly wire: Wire;
}

/** A profile frame and its local return capability, preserved through routing. */
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
 */
export interface Wire {
  send(path: Path, message: Message): void;
  receive(path: Path, receiver: Receiver): () => void;
  close(code?: number, reason?: string): void;
}
