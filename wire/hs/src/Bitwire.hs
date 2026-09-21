-- | Haskell presentation of the shared Bitwire contract.
--
-- Derived from the common specification, not a Nightseam Haskell runtime.
-- Implementations own admission, asynchronous dispatch, routing and closure.
module Bitwire
  ( Path
  , Code (..)
  , JsonPayload (..)
  , Metadata
  , Trace (..)
  , ProfileError (..)
  , ProfileKind (..)
  , ProfileBody (..)
  , ProfileFrame (..)
  , profileVersion
  , profileKind
  , ReturnAddress
  , newReturnAddress
  , returnWire
  , Message (..)
  , Receiver (..)
  , Wire (..)
  ) where

import Data.ByteString (ByteString)
import Data.Map.Strict (Map)
import Data.Text (Text)
import Data.Unique (Unique, newUnique)

-- | Relative Unicode-scalar string segments. Text supplies scalar strings;
-- implementations must not normalize, split or otherwise interpret them.
-- In particular [], [""], ["a/b"] and ["a", "b"] are different paths.
type Path = [Text]

-- | Termination code whose interpretation belongs to the profile.
newtype Code = Code { unCode :: Int }
  deriving (Eq, Ord, Show)

-- | An encoded UTF-8 JSON value, retaining its original numeric precision.
-- Construction does not validate JSON. The profile implementation validates
-- payloads at its boundary; these bytes are never decoded through 'Double'.
newtype JsonPayload = JsonPayload { jsonBytes :: ByteString }
  deriving (Eq, Ord, Show)

type Metadata = Map Text Text

-- | Optional tracing members, preserved through composition.
data Trace = Trace
  { traceparent :: Maybe Text
  , tracestate :: Maybe Text
  } deriving (Eq, Show)

-- | Public error data; independent of an implementation's exception types.
data ProfileError = ProfileError
  { errorCode :: Text
  , errorMessage :: Text
  , errorData :: Maybe JsonPayload
  } deriving (Eq, Show)

data ProfileKind = RequestKind | ResponseKind | EventKind | CancelKind
  deriving (Eq, Ord, Show)

-- | The four logical frame bodies. A response contains either error data or
-- its result. Request methods and event names come only from the Send path.
-- A missing payload is distinct from the JSON value @null@.
data ProfileBody
  = Request Text JsonPayload (Maybe Metadata)
  | Response Text (Either ProfileError JsonPayload)
  | Event JsonPayload (Maybe Metadata)
  | Cancel Text
  deriving (Eq, Show)

-- | A version-one logical profile frame. No network encoding is prescribed by
-- this value representation and no return capability is a frame member.
data ProfileFrame = ProfileFrame
  { frameTrace :: Trace
  , frameBody :: ProfileBody
  } deriving (Eq, Show)

-- | Every frame represented by this binding uses profile version one.
profileVersion :: ProfileFrame -> Int
profileVersion _ = 1

profileKind :: ProfileFrame -> ProfileKind
profileKind frame = case frameBody frame of
  Request {} -> RequestKind
  Response {} -> ResponseKind
  Event {} -> EventKind
  Cancel {} -> CancelKind

-- | A local return capability with stable identity. Copying this value keeps
-- that identity; constructing another value for the same Wire creates a new
-- identity. Equality does not compare functions or depend on their addresses.
-- There are deliberately no serialization or textual reconstruction instances.
data ReturnAddress = ReturnAddress Unique Wire

instance Eq ReturnAddress where
  ReturnAddress a _ == ReturnAddress b _ = a == b

-- | Allocate a fresh local identity for a return capability. This creates no
-- endpoint, dispatcher, carrier, channel or registration.
newReturnAddress :: Wire -> IO ReturnAddress
newReturnAddress wire = do
  identity <- newUnique
  pure (ReturnAddress identity wire)

returnWire :: ReturnAddress -> Wire
returnWire (ReturnAddress _ wire) = wire

-- | Preserve both the frame and the optional local return identity through
-- routing, including any received invocation context privately associated with
-- that identity by an implementation. A return capability is never encoded into
-- a network envelope. Caller-supplied data is not evidence of verified context.
data Message = Message
  { messageFrame :: ProfileFrame
  , messageReturn :: Maybe ReturnAddress
  }

-- | Callbacks run in the dispatcher's IO context. Exact registrations win;
-- otherwise the longest matching namespace prefix wins. Paths delivered to
-- callbacks are relative to the Wire on which this receiver was registered.
data Receiver = Receiver
  { receiverNamespace :: Bool
  , onMessage :: Maybe (Path -> Message -> IO ())
  , onClosed :: Maybe (Code -> Text -> IO ())
  }

-- | An endpoint with an origin, represented by its three operations.
--
-- Send completes on admission or raises an IO exception on refusal; it does
-- not run destination application code on the sender's stack or await a reply.
-- Receive refuses duplicate registrations and returns an idempotent detach
-- action that prevents new dispatch. Close ends this endpoint according to its
-- ownership: a selected view shares closure; a mount owns only its routing and
-- registrations and leaves borrowed children usable.
--
-- Roots own queue bounds, scheduling and carrier closure. Providing this record
-- alone does not establish that an implementation obeys those behavioral laws.
data Wire = Wire
  { send :: Path -> Message -> IO ()
  , receive :: Path -> Receiver -> IO (IO ())
  , close :: Code -> Text -> IO ()
  }
