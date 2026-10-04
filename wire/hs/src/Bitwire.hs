module Bitwire
  ( Value(..), Path, Envelope(..), Termination(..), Wire(..), DeixisNode(..), Parts(..) ) where
import Data.ByteString (ByteString)
data Value = Atom ByteString | Tuple [Value] deriving (Eq, Show)
type Path = [ByteString]
data Envelope = Envelope
  { source :: Path, destination :: Path, messageId :: ByteString
  , correlation :: Maybe ByteString, payload :: Value } deriving (Eq, Show)
data Termination = Closed | Failed String deriving (Eq, Show)
data Wire = Wire
  { send :: Envelope -> IO (), receive :: (Envelope -> IO ()) -> IO (IO ())
  , closed :: IO Termination, close :: IO () }
data DeixisNode a = DeixisNode
  { own :: a, children :: [(ByteString, DeixisNode a)]
  , at :: Path -> Maybe (DeixisNode a), decompose :: Parts a }
data Parts a = Parts { partOwn :: a, partChildren :: [(ByteString, DeixisNode a)] }
