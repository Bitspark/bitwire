from bitwire import Wire, Endpoint, AddressedEndpoint, Atom, Tuple
async def send_only(wire: Wire) -> None:
    await wire.send(Atom())
async def consume(endpoint: Endpoint, addressed: AddressedEndpoint) -> None:
    detach = endpoint.receive(lambda message: None)
    await send_only(endpoint)
    await endpoint.send(Tuple())
    detach()
    await addressed.send((Atom(b'leaf'),), Atom())
    addressed.receive(lambda path, message: None)()
    await addressed.close()
    await addressed.closed()
    await endpoint.close()
    await endpoint.closed()
