from bitwire import Envelope, Wire, Atom, Tuple
async def consume(wire: Wire) -> None:
    detach = wire.receive(lambda e: None)
    await wire.send(Envelope((), (Atom(b'leaf'),), Atom(), Tuple()))
    detach()
    await wire.close()
    await wire.closed()
