// Public profile adapter only. The runner supplies inputs with no expectations.
import { readFileSync } from 'node:fs';
import type { Message, Wire } from '@bitspark/bitwire';
import { Invocation } from '@nightseam/runtime';

interface Step { op: string; id?: string; label?: string }
interface Case { id: string; limits: { captures: number; bodies: number }; steps: Step[] }

function observe(test: Case): unknown[] {
  let retirements = 0;
  const controls: string[] = [];
  const create = () => new Invocation(test.limits, () => { retirements++; });
  let invocation = create();
  // The public participant gets only Wire, with no native object to unwrap.
  const facade = (owner: Invocation): Wire => ({ send: (path, message) => owner.deliver(path, message) });
  let access = facade(invocation);
  let previous: Wire | undefined;
  const rows: unknown[] = [];
  const cancel: Message = { frame: { version: 1, kind: 'cancel', id: 'c:1' } };
  for (const action of test.steps) {
    if (action.op === 'snapshot') {
      rows.push({ label: action.label, retired: invocation.retired, retirements, controls: [...controls].sort() });
      continue;
    }
    let deliver: (() => void) | undefined;
    const event: Message = { frame: { version: 1, kind: 'event', data: null } };
    switch (action.op) {
      case 'replace': previous = access; invocation = create(); access = facade(invocation); break;
      case 'settle': invocation.settle(); break;
      case 'dispatchDone': invocation.dispatchDone(); break;
      case 'cancel': deliver = () => access.send(['invocation.control'], cancel); break;
      case 'oldCancel': {
        if (!previous) throw new Error('oldCancel without a previous invocation');
        const old = previous;
        deliver = () => old.send(['invocation.control'], cancel);
        break;
      }
      case 'unknown': deliver = () => access.send(['unsupported.operation', 'participant'], event); break;
      case 'wrongKind': deliver = () => access.send(['invocation.capture', 'participant'], cancel); break;
      case 'missingSink': deliver = () => access.send(['invocation.capture', 'participant'], event); break;
      case 'capture': case 'ready': case 'release': case 'begin': case 'done': {
        if (action.id === undefined) throw new Error('missing participant identifier');
        const id = action.id;
        const message: Message = action.op === 'capture' ? {
          ...event,
          return: { wire: { send(path, control) {
            if (path.length !== 0 || control.frame.kind !== 'cancel') throw new Error('invalid control delivery');
            controls.push(`${id}:${control.frame.id}`);
          } } },
        } : event;
        deliver = () => access.send([`invocation.${action.op}`, id], message);
        break;
      }
      default: throw new Error(`Unknown fixture operation: ${action.op}`);
    }
    let admitted = true;
    try { deliver?.(); } catch (error) {
      if (!action.label) throw error;
      admitted = false;
    }
    if (action.label) rows.push({ label: action.label, admitted });
  }
  return rows;
}

const fixture = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as { cases: Case[] };
process.stdout.write(`${JSON.stringify(fixture.cases.map(test => ({ id: test.id, observations: observe(test) })))}\n`);
