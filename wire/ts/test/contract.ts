import type { Endpoint, Message, Path, Receiver, ReturnAddress, AddressedWire, Wire, WireTree, DeixisNode } from '../src/index.js';

// Send-only objects are valid access capabilities and return destinations.
const sendOnly = { send(_path: Path, _message: Message): void {} };
const access: AddressedWire = sendOnly;
const returnAddress: ReturnAddress = { wire: sendOnly };
void returnAddress;

// @ts-expect-error Access does not grant receive attachment.
const owner: Endpoint = access;
void owner;

function ownerSide(endpoint: Endpoint, receiver: Receiver): AddressedWire {
  const detach: () => void = endpoint.receive(receiver);
  detach();
  endpoint.close();
  return endpoint;
}
void ownerSide;

const receiver: Receiver = {
  message(path, message) {
    access.send(path, message);
  },
  // @ts-expect-error Routing policy is not a primitive receiver option.
  namespace: true,
};
void receiver;

const primitive: Wire = { send(_message: Message): void {} };
// @ts-expect-error An opaque addressed capability does not supply full structure.
const treeFromAccess: WireTree = access;
// @ts-expect-error A primitive does not accept a path argument.
primitive.send([], { frame: { version: 1, kind: 'event', data: null } });
// @ts-expect-error An addressed capability is not an addressless primitive.
const primitiveFromAccess: Wire = access;
function useTree(tree: WireTree): void {
  const node: DeixisNode<Wire> | undefined = tree.at([new Uint8Array([255])]);
  node?.own().send({ frame: { version: 1, kind: 'event', data: null } });
  const { own, children } = tree.decompose();
  void [own, children, tree.children()];
}
void [primitive, treeFromAccess, primitiveFromAccess, useTree];
