package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"strings"
	"sync"
)

// direction says whose frame a mutation sees.
type direction int

const (
	// in is a frame travelling to the testee under test.
	in direction = iota
	// out is a frame the testee under test sent.
	out
)

func (d direction) String() string {
	if d == in {
		return "in"
	}
	return "out"
}

const (
	opContinuation = 0x0
	opText         = 0x1
	opBinary       = 0x2
	opClose        = 0x8
	opPing         = 0x9
	opPong         = 0xA
)

// bufferLimit is the largest data payload a mutation sees; larger frames
// stream through unchanged.
const bufferLimit = 4 << 20

// frame is one WebSocket frame (RFC 6455, section 5.2) with its payload
// unmasked. raw holds the frame's own header bytes until a mutation changes
// the frame.
type frame struct {
	b0      byte // FIN, RSV1–3 and the opcode, as received
	masked  bool
	key     [4]byte
	payload []byte
	raw     []byte
}

func (f *frame) opcode() byte { return f.b0 & 0x0F }
func (f *frame) fin() bool    { return f.b0&0x80 != 0 }
func (f *frame) data() bool   { return f.opcode() == opText || f.opcode() == opBinary }

// setOpcode changes the frame's kind and drops its original header.
func (f *frame) setOpcode(op byte) {
	f.b0 = f.b0&0xF0 | op
	f.raw = nil
}

// setPayload replaces the payload and drops the original header.
func (f *frame) setPayload(p []byte) {
	f.payload = p
	f.raw = nil
}

// closeCode is a close frame's status code, or 0 when it carries none.
func (f *frame) closeCode() int {
	if f.opcode() != opClose || len(f.payload) < 2 {
		return 0
	}
	return int(binary.BigEndian.Uint16(f.payload))
}

func (f *frame) setCloseCode(code int) {
	p := append([]byte{byte(code >> 8), byte(code)}, f.payload[2:]...)
	f.setPayload(p)
}

// encode writes the frame: its original header when unchanged, otherwise a
// new one with the minimal length encoding and the frame's own mask key.
func (f *frame) encode() []byte {
	var b bytes.Buffer
	if f.raw != nil {
		b.Write(f.raw)
	} else {
		b.WriteByte(f.b0)
		var mask byte
		if f.masked {
			mask = 0x80
		}
		n := len(f.payload)
		switch {
		case n < 126:
			b.WriteByte(mask | byte(n))
		case n <= 0xFFFF:
			b.WriteByte(mask | 126)
			binary.Write(&b, binary.BigEndian, uint16(n))
		default:
			b.WriteByte(mask | 127)
			binary.Write(&b, binary.BigEndian, uint64(n))
		}
		if f.masked {
			b.Write(f.key[:])
		}
	}
	p := bytes.Clone(f.payload)
	if f.masked {
		for i := range p {
			p[i] ^= f.key[i%4]
		}
	}
	b.Write(p)
	return b.Bytes()
}

// header is a frame's header as read, before its payload.
type header struct {
	frame
	length uint64
}

func readHeader(r *bufio.Reader) (*header, error) {
	var raw []byte
	next := func(n int) ([]byte, error) {
		b := make([]byte, n)
		if _, err := io.ReadFull(r, b); err != nil {
			return nil, err
		}
		raw = append(raw, b...)
		return b, nil
	}
	b, err := next(2)
	if err != nil {
		return nil, err
	}
	h := &header{frame: frame{b0: b[0], masked: b[1]&0x80 != 0}}
	h.length = uint64(b[1] & 0x7F)
	switch h.length {
	case 126:
		ext, err := next(2)
		if err != nil {
			return nil, err
		}
		h.length = uint64(binary.BigEndian.Uint16(ext))
	case 127:
		ext, err := next(8)
		if err != nil {
			return nil, err
		}
		h.length = binary.BigEndian.Uint64(ext)
	}
	if h.masked {
		k, err := next(4)
		if err != nil {
			return nil, err
		}
		copy(h.key[:], k)
	}
	h.raw = raw
	return h, nil
}

// frameFunc changes one frame. It returns the frames to send in its place, none
// to drop it, or abort to end both connections at once without a close.
type frameFunc func(dir direction, f *frame) (emit []*frame, abort bool)

// relay stands in front of one WebSocket endpoint: it accepts a connection,
// dials the endpoint, passes the handshake through (with the Host header set
// to the endpoint's), and then relays frames, letting a mutation change them.
type relay struct {
	ln            net.Listener
	url           string
	target        string
	mutantListens bool
	frames        func() frameFunc
	mu            sync.Mutex
	conns         []net.Conn
	closed        bool
}

func newRelay(rawURL string, mutantListens bool, frames func() frameFunc) (*relay, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	if u.Scheme != "ws" {
		return nil, fmt.Errorf("relay: only ws URLs are relayed, not %q", rawURL)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	r := &relay{ln: ln, target: u.Host, mutantListens: mutantListens, frames: frames}
	front := *u
	front.Host = ln.Addr().String()
	r.url = front.String()
	go r.serve()
	return r, nil
}

func (r *relay) serve() {
	for {
		c, err := r.ln.Accept()
		if err != nil {
			return
		}
		go r.pair(c)
	}
}

func (r *relay) track(cs ...net.Conn) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return false
	}
	r.conns = append(r.conns, cs...)
	return true
}

func (r *relay) close() {
	r.mu.Lock()
	r.closed = true
	conns := r.conns
	r.conns = nil
	r.mu.Unlock()
	r.ln.Close()
	for _, c := range conns {
		c.Close()
	}
}

func (r *relay) pair(client net.Conn) {
	server, err := net.Dial("tcp", r.target)
	if err != nil {
		client.Close()
		return
	}
	if !r.track(client, server) {
		client.Close()
		server.Close()
		return
	}
	toServer, toClient := in, out
	if !r.mutantListens {
		toServer, toClient = out, in
	}
	var once sync.Once
	abort := func() {
		once.Do(func() {
			client.Close()
			server.Close()
		})
	}
	var mutate frameFunc
	if r.frames != nil {
		mutate = r.frames()
	}
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); r.pump(client, server, toServer, true, mutate, abort) }()
	go func() { defer wg.Done(); r.pump(server, client, toClient, false, mutate, abort) }()
	wg.Wait()
	client.Close()
	server.Close()
}

// pump relays src to dst: the handshake block first, then frames.
func (r *relay) pump(src, dst net.Conn, dir direction, request bool, mutate frameFunc, abort func()) {
	br := bufio.NewReaderSize(src, 64<<10)
	upgraded, err := r.handshake(br, dst, request)
	if err != nil {
		r.ended(src, dst, err)
		return
	}
	if !upgraded {
		io.Copy(dst, br)
		halfClose(dst)
		return
	}
	for {
		h, err := readHeader(br)
		if err != nil {
			r.ended(src, dst, err)
			return
		}
		f := &h.frame
		inspect := mutate != nil && (!f.data() || (f.fin() && h.length <= bufferLimit)) && f.opcode() != opContinuation
		if !inspect {
			if _, err := dst.Write(h.raw); err != nil {
				discard(br)
				return
			}
			if _, err := io.CopyN(dst, br, int64(h.length)); err != nil {
				if errors.Is(err, io.EOF) || isReadErr(err) {
					r.ended(src, dst, err)
				} else {
					discard(br)
				}
				return
			}
			continue
		}
		f.payload = make([]byte, h.length)
		if n, err := io.ReadFull(br, f.payload); err != nil {
			// Pass on what arrived, still masked, and then the end.
			dst.Write(h.raw)
			dst.Write(f.payload[:n])
			r.ended(src, dst, err)
			return
		}
		if f.masked {
			for i := range f.payload {
				f.payload[i] ^= f.key[i%4]
			}
		}
		emit, stop := mutate(dir, f)
		if stop {
			abort()
			return
		}
		for _, e := range emit {
			if _, err := dst.Write(e.encode()); err != nil {
				discard(br)
				return
			}
		}
	}
}

// handshake passes the HTTP upgrade block through and reports whether the
// response switched protocols. On the request, Host names the endpoint.
func (r *relay) handshake(br *bufio.Reader, dst net.Conn, request bool) (bool, error) {
	var block bytes.Buffer
	first := true
	upgraded := false
	for {
		line, err := br.ReadString('\n')
		if err != nil {
			return false, err
		}
		if first {
			first = false
			if !request {
				fields := strings.Fields(line)
				upgraded = len(fields) >= 2 && fields[1] == "101"
			}
		} else if request && strings.HasPrefix(strings.ToLower(line), "host:") {
			line = "Host: " + r.target + "\r\n"
		}
		block.WriteString(line)
		if line == "\r\n" || line == "\n" {
			break
		}
	}
	if _, err := dst.Write(block.Bytes()); err != nil {
		return false, err
	}
	return upgraded || request, nil
}

// ended passes a source's end on: a clean end of input as a half-close, and
// anything else as the end of both connections.
func (r *relay) ended(src, dst net.Conn, err error) {
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		halfClose(dst)
		return
	}
	src.Close()
	dst.Close()
}

func halfClose(c net.Conn) {
	if tc, ok := c.(*net.TCPConn); ok {
		tc.CloseWrite()
		return
	}
	c.Close()
}

// discard keeps reading a source whose destination has gone, so that the
// source's writer is not blocked by the relay while its reader still works.
func discard(br *bufio.Reader) { io.Copy(io.Discard, br) }

func isReadErr(err error) bool {
	var op *net.OpError
	return errors.As(err, &op) && op.Op == "read"
}
