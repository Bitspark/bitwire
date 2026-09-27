// The bitwire-stream/1 framing vectors (conformance/stream/vectors.json):
// validation of the vector file, the byte sequences its parts denote, the read
// schedules every vector runs under, and a test-only reference receiver written
// from docs/wire/carriers.md. The reference has two parser architectures, one
// that decides byte by byte and one that buffers a header block before parsing
// it; a vector is portable only if both agree on it under every schedule.
import assert from 'node:assert/strict';

export const CLOSE_REASON_LIMIT = 123;
export const HEADER_CAP = 128;
const ends = new Set(['open', 'eof', 'truncated', 'closed', 'refused']);
const kinds = new Set(['text', 'binary']);
const sendable = code => (code >= 1000 && code <= 1003) || (code >= 1007 && code <= 1014) || (code >= 3000 && code <= 4999);

/** The bytes a list of parts denotes: an ASCII string, {hex} or {fill, count}. */
export function bytesOf(parts) {
  assert.ok(Array.isArray(parts), 'a byte sequence is a list of parts');
  const chunks = parts.map(part => {
    if (typeof part === 'string') {
      assert.match(part, /^[\t\n\r\x20-\x7e]*$/, `not restricted ASCII: ${JSON.stringify(part)}`);
      return Buffer.from(part, 'latin1');
    }
    if (part && Object.keys(part).join() === 'hex') {
      assert.match(part.hex, /^(?:[0-9a-f]{2})+$/, `invalid hex ${part.hex}`);
      return Buffer.from(part.hex, 'hex');
    }
    assert.ok(part && Object.keys(part).sort().join() === 'count,fill', `invalid part ${JSON.stringify(part)}`);
    assert.match(part.fill, /^[\x20-\x7e]$/, 'fill is one printable ASCII character');
    assert.ok(Number.isSafeInteger(part.count) && part.count > 0, 'fill count is a positive integer');
    return Buffer.alloc(part.count, part.fill, 'latin1');
  });
  return new Uint8Array(Buffer.concat(chunks));
}

const hex = bytes => Buffer.from(bytes).toString('hex');

/** Validates the vector file and returns its vectors with bytes resolved. */
export function loadVectors(document) {
  assert.equal(document.format, 'bitwire-stream/1');
  const ids = new Set();
  return document.vectors.map(vector => {
    const at = `vector ${vector.id}`;
    assert.deepEqual(Object.keys(vector).sort(), ['eof', 'expect', 'id', 'input', 'limit', 'why'], `${at}: members`);
    assert.match(vector.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${at}: id`);
    assert.ok(!ids.has(vector.id), `${at}: repeated id`);
    ids.add(vector.id);
    assert.ok(typeof vector.why === 'string' && vector.why.length > 0, `${at}: why`);
    assert.ok(Number.isSafeInteger(vector.limit) && vector.limit >= 0, `${at}: limit`);
    assert.equal(typeof vector.eof, 'boolean', `${at}: eof`);
    const { expect } = vector;
    assert.ok(Object.keys(expect).every(key => ['frames', 'peerClose', 'send', 'end'].includes(key)), `${at}: expect members`);
    assert.ok(ends.has(expect.end), `${at}: end`);
    assert.ok(Array.isArray(expect.frames), `${at}: frames`);
    const frames = expect.frames.map(frame => {
      assert.deepEqual(Object.keys(frame).sort(), ['body', 'kind'], `${at}: frame members`);
      assert.ok(kinds.has(frame.kind), `${at}: frame kind`);
      return { kind: frame.kind, body: hex(bytesOf(frame.body)) };
    });
    const closed = expect.end === 'closed', refused = expect.end === 'refused';
    assert.equal('peerClose' in expect, closed, `${at}: peerClose exactly when closed`);
    assert.equal('send' in expect, closed || refused, `${at}: send exactly when closed or refused`);
    if (expect.end === 'open') assert.equal(vector.eof, false, `${at}: open needs input that has not ended`);
    if (expect.end === 'eof' || expect.end === 'truncated') assert.equal(vector.eof, true, `${at}: ${expect.end} needs end of input`);
    let peerClose;
    if (closed) {
      assert.deepEqual(Object.keys(expect.peerClose).sort(), ['code', 'reason'], `${at}: peerClose members`);
      assert.ok(sendable(expect.peerClose.code), `${at}: peerClose code`);
      peerClose = { code: expect.peerClose.code, reason: hex(bytesOf(expect.peerClose.reason)) };
      assert.deepEqual(expect.send, { code: peerClose.code }, `${at}: the reply echoes the received code`);
    }
    if (refused) assert.ok([1002, 1009].includes(expect.send?.code) && Object.keys(expect.send).join() === 'code', `${at}: a refusal sends 1002 or 1009`);
    return {
      id: vector.id, limit: vector.limit, eof: vector.eof, input: bytesOf(vector.input),
      // A close record this side sends always has an empty reason.
      expect: { frames, ...(peerClose && { peerClose }), ...(expect.send && { send: { code: expect.send.code, reason: '' } }), end: expect.end },
    };
  });
}

/** Every read schedule: one read, one byte per read, and each split into two reads. */
export function* schedules(bytes) {
  yield { name: 'whole', chunks: bytes.length ? [bytes] : [] };
  if (bytes.length > 1) yield { name: 'byte-by-byte', chunks: Array.from(bytes, b => Uint8Array.of(b)) };
  for (let i = 1; i < bytes.length; i++) yield { name: `split at ${i}`, chunks: [bytes.subarray(0, i), bytes.subarray(i)] };
}

const ascii = text => Uint8Array.from(text, c => c.charCodeAt(0));
const FRAME = ascii('Frame: '), CODE = ascii('Code: '), LENGTH = ascii('Content-Length: '), CRLF = ascii('\r\n');
const KINDS = ['text', 'binary', 'close'].map(kind => ({ kind, bytes: ascii(kind) }));

// Matches a literal at buf[at..]: 'ok', 'need' (buf ends inside it) or 'bad'.
function literal(buf, at, lit, fold) {
  for (let i = 0; i < lit.length; i++) {
    if (at + i >= buf.length) return 'need';
    let b = buf[at + i];
    if (fold && b >= 0x41 && b <= 0x5a) b += 0x20;
    const l = fold && lit[i] >= 0x41 && lit[i] <= 0x5a ? lit[i] + 0x20 : lit[i];
    if (b !== l) return 'bad';
  }
  return 'ok';
}

/**
 * The byte-by-byte header parser: {status: 'complete', kind, code, length,
 * size}, 'need' when buf is a proper prefix of a valid header block, or 'bad'.
 * A mutant set changes it into one of the realizations the vectors must reject.
 */
function parseHeader(buf, mutants, limit) {
  const fold = mutants.has('lenient-case');
  let at = 0;
  const eol = () => {
    if (mutants.has('lf-endings') && buf[at] === 0x0a) { at += 1; return 'ok'; }
    const r = literal(buf, at, CRLF, false);
    if (r === 'ok') at += 2;
    return r;
  };
  if (mutants.has('skips-preamble')) {
    const start = buf.indexOf(0x46); // 'F'
    if (start < 0) return { status: 'need' };
    at = start;
  }
  let r = literal(buf, at, FRAME, fold);
  if (r !== 'ok') return { status: r };
  at += FRAME.length;
  if (at >= buf.length) return { status: 'need' };
  const lower = fold && buf[at] >= 0x41 && buf[at] <= 0x5a ? buf[at] + 0x20 : buf[at];
  const found = KINDS.find(k => k.bytes[0] === lower);
  if (!found) return { status: 'bad' };
  r = literal(buf, at, found.bytes, fold);
  if (r !== 'ok') return { status: r };
  at += found.bytes.length;
  if ((r = eol()) !== 'ok') return { status: r };
  let code;
  if (found.kind === 'close') {
    if ((r = literal(buf, at, CODE, fold)) !== 'ok') return { status: r };
    at += CODE.length;
    code = 0;
    for (let i = 0; i < 4; i++, at++) {
      if (at >= buf.length) return { status: 'need' };
      if (buf[at] < 0x30 || buf[at] > 0x39) return { status: 'bad' };
      code = code * 10 + (buf[at] - 0x30);
    }
    if (mutants.has('early-code-check') && !sendable(code)) return { status: 'bad' };
    if ((r = eol()) !== 'ok') return { status: r };
  }
  if ((r = literal(buf, at, LENGTH, fold)) !== 'ok') return { status: r };
  at += LENGTH.length;
  let digits = 0, length = 0n, narrow = 0;
  const maxDigits = mutants.has('sixteen-digits') ? 16 : 15;
  for (;;) {
    if (at >= buf.length) return { status: 'need' };
    const b = buf[at];
    if (b < 0x30 || b > 0x39) break;
    if (digits === 1 && length === 0n && !mutants.has('leading-zeros')) return { status: 'bad' };
    if (digits === maxDigits) return { status: 'bad' };
    length = length * 10n + BigInt(b - 0x30);
    narrow = (narrow * 10 + (b - 0x30)) >>> 0;
    digits += 1;
    at += 1;
    if (mutants.has('limit-before-grammar') && found.kind !== 'close' && length > BigInt(limit)) return { status: 'early-over-limit' };
  }
  if (digits === 0) return { status: 'bad' };
  if ((r = eol()) !== 'ok') return { status: r };
  if ((r = eol()) !== 'ok') return { status: r };
  if (mutants.has('narrow-length')) length = BigInt(narrow);
  return { status: 'complete', kind: found.kind, code, length, size: at };
}

const HEADER = /^Frame: (text|binary)\r\nContent-Length: (0|[1-9][0-9]{0,14})\r\n\r\n$/;
const SKELETONS = ['Frame: text\r\nContent-Length: ', 'Frame: binary\r\nContent-Length: ', 'Frame: close\r\nCode: ####\r\nContent-Length: '];
const LENGTH_PREFIX = /^(?:0(?:\r(?:\n\r?)?)?|[1-9][0-9]{0,14}(?:\r(?:\n\r?)?)?)?$/;

// Whether an incomplete header block is a prefix of a valid one: its own test,
// independent of the byte-by-byte parser.
function isHeaderPrefix(text) {
  return SKELETONS.some(skeleton => {
    const n = Math.min(text.length, skeleton.length);
    for (let i = 0; i < n; i++) {
      if (skeleton[i] === '#' ? !(text[i] >= '0' && text[i] <= '9') : skeleton[i] !== text[i]) return false;
    }
    return text.length <= skeleton.length || LENGTH_PREFIX.test(text.slice(skeleton.length));
  });
}
const CLOSE_HEADER = /^Frame: close\r\nCode: ([0-9]{4})\r\nContent-Length: (0|[1-9][0-9]{0,14})\r\n\r\n$/;

// The buffering header parser: waits for the first empty line, the header cap
// or the end of input, then matches the whole block. At the end of input it
// decides truncation with the prefix rule, as a buffering receiver must.
function parseHeaderBuffered(buf, ended) {
  let end = -1;
  for (let i = 3; i < buf.length && i < HEADER_CAP; i++) {
    if (buf[i - 3] === 0x0d && buf[i - 2] === 0x0a && buf[i - 1] === 0x0d && buf[i] === 0x0a) { end = i + 1; break; }
  }
  if (end < 0) {
    if (buf.length >= HEADER_CAP) return { status: 'bad' };
    return ended ? { status: isHeaderPrefix(Buffer.from(buf).toString('latin1')) ? 'need' : 'bad' } : { status: 'need' };
  }
  const block = Buffer.from(buf.subarray(0, end)).toString('latin1');
  let m = HEADER.exec(block);
  if (m) return { status: 'complete', kind: m[1], length: BigInt(m[2]), size: end };
  m = CLOSE_HEADER.exec(block);
  if (m) return { status: 'complete', kind: 'close', code: Number(m[1]), length: BigInt(m[2]), size: end };
  return { status: 'bad' };
}

function validUtf8(bytes) {
  try { new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); return true; } catch { return false; }
}

/**
 * A receiving side of bitwire-stream/1. push(bytes, eof) delivers one read, and
 * eof marks the end of input arriving with it; end() is a separate end of input.
 * outcome() reports the frames delivered, the close received, the close record
 * this side sends (always with an empty reason) and how its input ended.
 */
export class Receiver {
  constructor({ limit, buffering = false, mutants = [] }) {
    this.limit = limit;
    this.buffering = buffering;
    this.mutants = new Set(mutants);
    this.buf = new Uint8Array(0);
    this.header = undefined;
    this.frames = [];
    this.state = 'open';
  }

  push(bytes, eof = false) {
    if (eof && this.mutants.has('drops-final-bytes')) return this.end();
    if (this.state === 'open') {
      const next = new Uint8Array(this.buf.length + bytes.length);
      next.set(this.buf);
      next.set(bytes, this.buf.length);
      this.buf = next;
      this.#advance(false);
    } else if (this.after) {
      this.after.push(bytes);
    }
    if (eof) this.end();
  }

  end() {
    if (this.state !== 'open') return;
    this.#advance(true);
    if (this.state !== 'open') return;
    if (this.header === undefined && this.buf.length === 0) this.state = 'eof';
    else if (this.mutants.has('eof-in-header-is-error') && this.header === undefined) this.#refuse(1002);
    else this.state = 'truncated';
  }

  outcome() {
    const frames = this.after ? [...this.frames, ...this.after.frames] : this.frames;
    const out = { frames: frames.map(f => ({ kind: f.kind, body: hex(f.body) })) };
    if (this.peerClose) out.peerClose = { code: this.peerClose.code, reason: hex(this.peerClose.reason) };
    if (this.send) out.send = { code: this.send.code, reason: hex(this.send.reason) };
    out.end = this.state === 'eof' || this.state === 'truncated' || this.state === 'closed' || this.state === 'refused' ? this.state : 'open';
    return out;
  }

  #refuse(code) {
    this.state = 'refused';
    this.send = { code, reason: new Uint8Array(0) };
  }

  #advance(ended) {
    while (this.state === 'open') {
      if (this.header === undefined) {
        const parsed = this.buffering ? parseHeaderBuffered(this.buf, ended) : parseHeader(this.buf, this.mutants, this.limit);
        if (parsed.status === 'need') {
          if (ended && this.buffering) return;
          if (!this.buffering && this.buf.length >= HEADER_CAP) return this.#refuse(1002);
          return;
        }
        if (parsed.status === 'bad') return this.#refuse(1002);
        if (parsed.status === 'early-over-limit') return this.#refuse(1009);
        this.buf = this.buf.subarray(parsed.size);
        if (parsed.kind === 'close') {
          if (!sendable(parsed.code) && !(this.mutants.has('registry-codes') && parsed.code >= 1000 && parsed.code <= 4999)) return this.#refuse(1002);
          const closeLimit = this.mutants.has('close-counts-data-limit') ? this.limit : CLOSE_REASON_LIMIT;
          if (parsed.length > BigInt(closeLimit)) return this.#refuse(1002);
        } else if (parsed.length > BigInt(this.limit)) {
          if (this.mutants.has('waits-for-body')) { this.header = { ...parsed, overLimit: true }; continue; }
          return this.#refuse(1009);
        }
        this.header = parsed;
      }
      const length = Number(this.header.length);
      if (this.buf.length < length) return;
      const body = this.buf.slice(0, length);
      this.buf = this.buf.subarray(length);
      const header = this.header;
      this.header = undefined;
      if (header.overLimit) return this.#refuse(1009);
      if (header.kind === 'close') {
        if (!validUtf8(body)) return this.#refuse(1002);
        this.peerClose = { code: header.code, reason: body };
        this.send = { code: header.code, reason: this.mutants.has('echoes-reason') ? body : new Uint8Array(0) };
        this.state = 'closed';
        if (this.mutants.has('delivers-after-close')) {
          // Keeps parsing records after a close.
          this.after = new Receiver({ limit: this.limit, buffering: this.buffering });
          this.after.push(this.buf);
        }
        return;
      }
      if (header.kind === 'text' && this.mutants.has('validates-text') && !validUtf8(body)) return this.#refuse(1002);
      this.frames.push({ kind: header.kind, body });
    }
  }
}

/** Runs one vector under one schedule; eofWithLast delivers the end of input with the last read. */
export function run(vector, chunks, { buffering = false, mutants = [], eofWithLast = false } = {}) {
  const receiver = new Receiver({ limit: vector.limit, buffering, mutants });
  chunks.forEach((chunk, i) => receiver.push(chunk, vector.eof && eofWithLast && i === chunks.length - 1));
  if (vector.eof && !(eofWithLast && chunks.length)) receiver.end();
  return receiver.outcome();
}
