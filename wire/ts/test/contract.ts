import type { Endpoint, Message, Path, Receiver, ReturnAddress, Wire } from '../src/index.js';

// Send-only objects are valid access capabilities and return destinations.
const sendOnly = { send(_path: Path, _message: Message): void {} };
const access: Wire = sendOnly;
const returnAddress: ReturnAddress = { wire: sendOnly };
void returnAddress;

// @ts-expect-error Access does not grant receive attachment.
const owner: Endpoint = access;
void owner;

function ownerSide(endpoint: Endpoint, receiver: Receiver): Wire {
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
