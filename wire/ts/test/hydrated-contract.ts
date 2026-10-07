import { atom, tuple } from '../src/index.js';
import type { Wire, HydratedValue, HydratedWire, HydratedTuple, HydratedEndpoint, Termination } from '../src/index.js';
const ground: HydratedValue = tuple([atom([0, 255])]);
export function nativeSurface(endpoint: HydratedEndpoint, raw: Wire): void {
  const sender: HydratedWire = endpoint.wire;
  const detach = endpoint.receive((value, context) => { void value; void context; });
  void sender.send(ground);
  void sender.send(sender);
  const end: Promise<Termination> = endpoint.closed;
  void end; detach(); void endpoint.close();
  // @ts-expect-error Ground-only Wire cannot accept live leaves.
  const invalid: HydratedWire = raw;
  // @ts-expect-error A conveyed sending face grants no close authority.
  sender.close();
  void invalid;
}
export function tupleView(value: HydratedTuple): HydratedValue | undefined {
  const children: readonly HydratedValue[] = value.items();
  void children; return value.at(value.length - 1);
}
