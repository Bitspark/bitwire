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

from bitwire import HydratedWire, HydratedEndpoint, HydratedValue, ReceivedContext
async def hydrated_surface(owner: HydratedEndpoint, sender: HydratedWire) -> None:
    value: HydratedValue = Tuple((Atom(),))
    def receiver(message: HydratedValue, context: ReceivedContext) -> None:
        pass
    detach = owner.receive(receiver)
    await sender.send(value)
    await sender.send(owner.wire)
    detach()
    await owner.close()
    await owner.closed()
