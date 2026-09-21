import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { at, mount, type Message, type Path, type Receiver, type ReturnAddress, type Wire } from '@nightseam/duplex';
import { callWire, forwardWire, wirePair, UnpublishedError } from '@nightseam/runtime';

// This driver records observations. Expected outcomes belong to the shared
// fixture and its runner, not to this implementation-specific adapter.
interface BaseCase {
  id: string;
}
interface AccessCase extends BaseCase {
  kind: 'access';
  prefix: string[];
  selections: string[][];
  mountKey: string | null;
  path: string[];
  payload: unknown;
}
interface Registration {
  id: string;
  path: string[];
  namespace: boolean;
  result: unknown;
}
interface RoutingCase extends BaseCase {
  kind: 'routing';
  registrations: Registration[];
  calls: { path: string[] }[];
  duplicate: { registration: string };
  profileRefusals?: string[][];
}
interface LifetimeCase extends BaseCase {
  kind: 'lifetime';
  path: string[];
  payload: unknown;
}
interface ForwardingCase extends BaseCase {
  kind: 'forwarding';
  path: string[];
  payload: unknown;
}
type Case = AccessCase | RoutingCase | LifetimeCase | ForwardingCase;

const deadlineMs = 5_000;
function call(wire: Wire, path: Path, value: unknown): Promise<unknown> {
  return callWire(wire, path, value, { timeoutMs: deadlineMs });
}

function reply(message: Message, result: unknown): void {
  if (message.frame.kind !== 'request' || !message.return) {
    throw new Error('Expected a request with return access.');
  }
  message.return.wire.send([], {
    frame: { version: 1, kind: 'response', id: message.frame.id, result },
  });
}

// Spies delegate every operation to the real endpoint. They do not implement
// dispatch, routing, correlation, or closure themselves.
function observe(
  wire: Wire,
  hooks: { send?: (path: Path, message: Message) => void; receive?: (path: Path, message: Message) => void },
): Wire {
  return {
    send(path, message) {
      hooks.send?.(path, message);
      wire.send(path, message);
    },
    receive(path, receiver) {
      return wire.receive(path, {
        ...receiver,
        message(delivered, message) {
          hooks.receive?.(delivered, message);
          return receiver.message?.(delivered, message);
        },
      });
    },
    close: (code, reason) => wire.close(code, reason),
  };
}

async function access(test: AccessCase) {
  const [client, server] = wirePair();
  let mounted: Wire | undefined;
  try {
    let originalReturn: ReturnAddress | undefined;
    let rootReturn: ReturnAddress | undefined;
    let admittedReturn: ReturnAddress | undefined;
    let receivedReturn: ReturnAddress | undefined;
    let rootPath: Path | undefined;
    let receiverPath: Path | undefined;
    const clientSpy = observe(client, {
      send(path, message) {
        rootPath = [...path];
        rootReturn = message.return;
      },
    });
    const serverSpy = observe(server, {
      receive(_path, message) {
        admittedReturn = message.return;
      },
    });
    let selected = at(clientSpy, test.prefix);
    if (test.mountKey !== null) {
      mounted = mount(new Map([[test.mountKey, selected]]));
      selected = at(mounted, [test.mountKey]);
    }
    for (const prefix of test.selections) selected = at(selected, prefix);
    const outer = observe(selected, {
      send(_path, message) {
        originalReturn = message.return;
      },
    });
    const receiver = at(serverSpy, [...test.prefix, ...test.selections.flat()]);
    receiver.receive(test.path, {
      message(path, message) {
        receiverPath = [...path];
        receivedReturn = message.return;
        if (message.frame.kind !== 'request') throw new Error('Expected request.');
        reply(message, message.frame.params);
      },
    });
    const payload = await call(outer, test.path, test.payload);
    return {
      rootPath,
      receiverPath,
      payload,
      sendReturnIdentity: originalReturn !== undefined && originalReturn === rootReturn,
      receiveReturnIdentity: admittedReturn !== undefined && admittedReturn === receivedReturn,
    };
  } finally {
    mounted?.close();
    client.close();
  }
}

async function routing(test: RoutingCase) {
  const [client, server] = wirePair();
  try {
    const receivers = new Map<string, Receiver>();
    for (const registration of test.registrations) {
      const receiver: Receiver = {
        namespace: registration.namespace,
        message(path, message) {
          reply(message, { result: registration.result, receiverPath: [...path], receiver: registration.id });
        },
      };
      receivers.set(registration.id, receiver);
      server.receive(registration.path, receiver);
    }
    const duplicate = test.registrations.find((registration) => registration.id === test.duplicate.registration);
    if (!duplicate) throw new Error('Duplicate target does not name a registration.');
    let duplicateRefused = false;
    try {
      const detach = server.receive(duplicate.path, receivers.get(duplicate.id)!);
      detach();
    } catch {
      duplicateRefused = true;
    }
    const calls: unknown[] = [];
    for (const entry of test.calls) calls.push(await call(client, entry.path, null));
    if (test.profileRefusals) {
      const requestRefusals = [];
      for (const path of test.profileRefusals) {
        let refused = false;
        try {
          await call(client, path, null);
        } catch (error) {
          refused = error instanceof UnpublishedError;
        }
        requestRefusals.push({ path: [...path], refused });
      }
      return { calls, duplicateRefused, requestRefusals };
    }
    return { calls, duplicateRefused };
  } finally {
    client.close();
  }
}

async function lifetime(test: LifetimeCase) {
  const [client, server] = wirePair();
  const mounted = mount(new Map([['leaf', client]]));
  let mountCloseCount = 0;
  let detachCloseCount = 0;
  try {
    const receiver: Receiver = {
      message(_path, message) {
        if (message.frame.kind !== 'request') throw new Error('Expected request.');
        reply(message, message.frame.params);
      },
      closed() {
        detachCloseCount++;
      },
    };
    const detach = server.receive(test.path, receiver);
    const selected = at(mounted, ['leaf']);
    const before = await call(selected, test.path, test.payload);
    detach();
    detach();
    // Re-registering demonstrates that detachment released the registration.
    const detachAgain = server.receive(test.path, { message: receiver.message });
    const afterDetach = await call(selected, test.path, test.payload);
    mounted.receive([], {
      namespace: true,
      message() {},
      closed() {
        mountCloseCount++;
      },
    });
    let mountOriginRefused = false;
    try {
      mounted.send([], { frame: { version: 1, kind: 'event', data: null } });
    } catch {
      mountOriginRefused = true;
    }
    mounted.close();
    mounted.close();
    let mountRegistrationReleased = false;
    try {
      const removeProbe = client.receive([], { namespace: true, message() {} });
      removeProbe();
      mountRegistrationReleased = true;
    } catch {
      // The recorded observation will differ from the independent fixture.
    }
    const afterMountClose = await call(client, test.path, test.payload);
    detachAgain();
    at(client, []).close();
    // Let the real root deliver its asynchronous closure notifications before
    // observing that detached receivers did not receive one.
    await setImmediate();
    let selectedCloseRefused = false;
    try {
      client.send(test.path, { frame: { version: 1, kind: 'event', data: null } });
    } catch {
      selectedCloseRefused = true;
    }
    return {
      before,
      afterDetach,
      afterMountClose,
      selectedCloseRefused,
      mountOriginRefused,
      mountCloseCount,
      mountRegistrationReleased,
      detachCloseCount,
    };
  } finally {
    mounted.close();
    client.close();
  }
}

async function forwarding(test: ForwardingCase) {
  const [caller, inbound] = wirePair();
  const [outbound, server] = wirePair();
  let detach: (() => void) | undefined;
  try {
    let inboundReturn: ReturnAddress | undefined;
    let outboundReturn: ReturnAddress | undefined;
    const inboundSpy = observe(inbound, { receive(_path, message) { inboundReturn = message.return; } });
    const outboundSpy = observe(outbound, { send(_path, message) { outboundReturn = message.return; } });
    detach = forwardWire(inboundSpy, outboundSpy);
    const receiver: Receiver = {
      message(_path, message) {
        if (message.frame.kind !== 'request') throw new Error('Expected request.');
        reply(message, message.frame.params);
      },
    };
    server.receive(test.path, receiver);
    const forwarded = await call(caller, test.path, test.payload);
    const forwardReturnIdentity = inboundReturn !== undefined && inboundReturn === outboundReturn;
    detach();
    detach();
    // Register at the former forwarding endpoint and call each original pair.
    // Both borrowed endpoints remain usable after forwarding is detached.
    inbound.receive(test.path, receiver);
    const inboundAfterDetach = await call(caller, test.path, test.payload);
    const outboundAfterDetach = await call(outbound, test.path, test.payload);
    return { forwarded, inboundAfterDetach, outboundAfterDetach, forwardReturnIdentity };
  } finally {
    detach?.();
    caller.close();
    outbound.close();
  }
}

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error('Usage: driver.ts <cases.json>');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { schemaVersion: number; cases: Case[] };
if (fixture.schemaVersion !== 1 || !Array.isArray(fixture.cases)) throw new Error('Unsupported fixture schema.');
const observations = [];
for (const test of fixture.cases) {
  let result: unknown;
  try {
    switch (test.kind) {
      case 'access': result = await access(test); break;
      case 'routing': result = await routing(test); break;
      case 'lifetime': result = await lifetime(test); break;
      case 'forwarding': result = await forwarding(test); break;
      default: throw new Error(`Unknown case kind: ${(test as { kind: string }).kind}`);
    }
  } catch (error) {
    throw new Error(`Conformance case ${test.id} could not execute.`, { cause: error });
  }
  observations.push({ id: test.id, observations: result });
}
process.stdout.write(`${JSON.stringify(observations)}\n`);
