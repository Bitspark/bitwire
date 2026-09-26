-- | Haskell presentation of the shared Bitwire contract.
--
-- Derived from the common specification, not a Nightseam Haskell runtime.
-- Implementations own admission, asynchronous dispatch, routing and closure.
module Bitwire
  ( Path
  , Key
  , TreePath
  , DeixisNode (..)
  , NodeParts (..)
  , WireTree
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
  , AddressedWire (..)
  , Endpoint (..)
  ) where

import Data.ByteString (ByteString)
import Data.Map.Strict (Map)
import Data.Text (Text)
import Data.Unique (Unique, newUnique)

-- | Relative Unicode-scalar string segments. Text supplies scalar strings;
-- implementations must not normalize, split or otherwise interpret them.
-- In particular [], [""], ["a/b"] and ["a", "b"] are different paths.
type Path = [Text]

-- | Exact binary key, including the empty byte string. No UTF-8 decoding,
-- normalization, or separator interpretation is performed.
type Key = ByteString

-- | Structural paths are binary key sequences. An empty path selects the
-- current node; a path containing one empty key selects its empty-key child.
type TreePath = [Key]

-- | Common structural contract for finite, acyclic trees of payloads. Every
-- implementation must expose the complete child map, keep own values and child
-- edges stable, return the current node from @at []@, and return 'Nothing' only
-- for missing paths. A child whose Wire refuses remains a present child.
--
-- 'decompose' must return exactly 'own' and 'children'; rebuilding those parts
-- preserves every edge and payload. The record describes these obligations;
-- production constructors, validation and traversal belong to a runtime.
data DeixisNode a = DeixisNode
  { own :: a
  , children :: Map Key (DeixisNode a)
  , at :: TreePath -> Maybe (DeixisNode a)
  , decompose :: NodeParts a
  }

-- | Complete parts of a node, with exact byte-key equality supplied by Map.
data NodeParts a = NodeParts
  { partsOwn :: a
  , partsChildren :: Map Key (DeixisNode a)
  }

-- | Structured interaction: every node holds an addressless 'Wire'.
-- For a present path, sending is @send (own selected) message@ where
-- @selected@ is the result of @at tree path@. Missing is never root fallback.
-- The storage lane has the same shape: @DataTree = DeixisNode Data@, where
-- Data is an addressless read capability, not the bytes returned by reading.
type WireTree = DeixisNode Wire

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
-- that identity; constructing another value for the same AddressedWire creates a new
-- identity. Equality does not compare functions or depend on their addresses.
-- There are deliberately no serialization or textual reconstruction instances.
data ReturnAddress = ReturnAddress Unique AddressedWire

instance Eq ReturnAddress where
  ReturnAddress a _ == ReturnAddress b _ = a == b

-- | Allocate a fresh local identity for a return capability. This creates no
-- endpoint, dispatcher, carrier, channel or registration.
newReturnAddress :: AddressedWire -> IO ReturnAddress
newReturnAddress wire = do
  identity <- newUnique
  pure (ReturnAddress identity wire)

returnWire :: ReturnAddress -> AddressedWire
returnWire (ReturnAddress _ wire) = wire

-- | Preserve both the frame and the optional local return identity through
-- routing, including any received invocation context privately associated with
-- that identity by an implementation. A return capability is never encoded into
-- a network envelope. Caller-supplied data is not evidence of verified context.
data Message = Message
  { messageFrame :: ProfileFrame
  , messageReturn :: Maybe ReturnAddress
  }

-- | Callbacks run in the dispatcher's IO context. Paths are relative to the
-- endpoint origin. Routing and matching policy belong to a separate dispatcher.
data Receiver = Receiver
  { onMessage :: Maybe (Path -> Message -> IO ())
  , onClosed :: Maybe (Code -> Text -> IO ())
  }

-- | Addressless send access. Admission refusal raises an IO exception.
-- Send does not run destination application code on the sender's stack or await
-- a reply. This capability does not grant receiver attachment or closure.
newtype Wire = Wire
  { send :: Message -> IO ()
  }

-- | Existing bitwire/1 addressed access, retained under an explicit name.
-- It exposes no complete tree and is not a 'WireTree'. Its Unicode-scalar
-- 'Path' and profile behavior remain unchanged; binary tree keys are separate.
newtype AddressedWire = AddressedWire
  { sendAddressed :: Path -> Message -> IO ()
  }

-- | Endpoint control bundles send access, receive attachment and lifecycle.
-- Receive refuses a second active attachment and returns an idempotent detach
-- action that prevents new dispatch. Already admitted requests retain their
-- return access. Roots own scheduling, admission bounds and carrier closure;
-- this record alone does not establish runtime behavioral conformance.
data Endpoint = Endpoint
  { endpointWire :: AddressedWire
  , receive :: Receiver -> IO (IO ())
  , close :: Code -> Text -> IO ()
  }
