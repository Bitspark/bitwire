module Bitwire
  ( Value(..), Path, Termination(..), Wire(..), Endpoint(..), AddressedWire(..)
  , AddressedEndpoint(..), WireTree, DeixisNode(..), Parts(..) ) where
import Data.ByteString (ByteString)
data Value = Atom ByteString | Tuple [Value] deriving (Eq, Show)
type Path = [ByteString]
data Termination = Closed | Failed String deriving (Eq, Show)
newtype Wire = Wire { send :: Value -> IO () }
data Endpoint = Endpoint
  { endpointWire :: Wire, receive :: (Value -> IO ()) -> IO (IO ())
  , closed :: IO Termination, close :: IO () }
newtype AddressedWire = AddressedWire { sendAt :: Path -> Value -> IO () }
data AddressedEndpoint = AddressedEndpoint
  { addressedWire :: AddressedWire, receiveAt :: (Path -> Value -> IO ()) -> IO (IO ())
  , addressedClosed :: IO Termination, addressedClose :: IO () }
data DeixisNode a = DeixisNode
  { own :: a, children :: [(ByteString, DeixisNode a)]
  , at :: Path -> Maybe (DeixisNode a), decompose :: Parts a }
data Parts a = Parts { partOwn :: a, partChildren :: [(ByteString, DeixisNode a)] }
type WireTree = DeixisNode Wire
