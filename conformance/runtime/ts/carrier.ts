// Selects the bitruntime carrier a conformance driver runs on, as ../go's
// internal/carrier does: a local pair, or a real WebSocket between two
// bitruntime peers whose client or server side sends. It supplies only
// construction and cleanup; every delivery is bitruntime's own.
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import type { Endpoint } from '@bitspark/bitwire';
import { pair } from '@bitspark/bitruntime/core';
import { Peer } from '@bitspark/bitruntime/engine';
import { CODE_NORMAL, webSocketConnection, type WebSocketLike } from '@bitspark/bitruntime/transports';

/** BITRUNTIME_CARRIER is local or peer; BITRUNTIME_REVERSE=1 makes a peer's server side the sending origin. */
export function kind(): 'local' | 'peer' {
  const carrier = process.env.BITRUNTIME_CARRIER;
  if (carrier !== 'local' && carrier !== 'peer') throw new Error('Expected BITRUNTIME_CARRIER=local or peer');
  if (!['', '0', '1'].includes(process.env.BITRUNTIME_REVERSE ?? '')) throw new Error('Expected BITRUNTIME_REVERSE=0 or 1');
  return carrier;
}

// ws implements the browser event surface the adapter uses; its overloaded
// addEventListener declaration has a different TypeScript shape.
function asLike(socket: WebSocket): WebSocketLike {
  socket.binaryType = 'arraybuffer';
  return socket as unknown as WebSocketLike;
}

/**
 * Returns two connected endpoints: sending on the first delivers to the
 * receiver of the second, and the reverse. cleanup registers each release.
 */
export async function connected(cleanup: (release: () => void) => void): Promise<[Endpoint, Endpoint]> {
  if (kind() === 'local') {
    const [a, b] = pair();
    cleanup(() => {
      a.close(CODE_NORMAL, 'done');
      b.close(CODE_NORMAL, 'done');
    });
    return [a, b];
  }
  const listener = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  cleanup(() => listener.close());
  await once(listener, 'listening', { signal: AbortSignal.timeout(5_000) });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('No WebSocket address');
  const accepted = once(listener, 'connection', { signal: AbortSignal.timeout(5_000) });
  // Both awaits can fail independently; keep a rejection handler while the
  // client's handshake is pending, then await this same promise.
  accepted.catch(() => {});
  listener.on('connection', (socket: WebSocket) => cleanup(() => socket.terminate()));
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}`);
  cleanup(() => socket.terminate());
  await once(socket, 'open', { signal: AbortSignal.timeout(5_000) });
  const [remote] = (await accepted) as [WebSocket];
  const client = new Peer({ role: 'client' });
  const server = new Peer({ role: 'server' });
  cleanup(() => {
    client.close();
    server.close();
  });
  await Promise.all([client.attach(webSocketConnection(asLike(socket))), server.attach(webSocketConnection(asLike(remote)))]);
  return process.env.BITRUNTIME_REVERSE === '1' ? [server.wire(), client.wire()] : [client.wire(), server.wire()];
}
