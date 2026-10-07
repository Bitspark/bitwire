module Main (main) where
import Bitwire
import qualified Data.ByteString as B
main :: IO ()
main = do
  let live = HydratedWire (\_ -> pure ())
  sendHydrated live (HydratedTuple [HydratedGround (Atom B.empty), HydratedWireValue live])
  let sender = Wire (\_ -> pure ())
  send sender (Atom B.empty)
  if ([] :: Path) == [B.empty] || Atom B.empty == Tuple [] then error "contract violation" else pure ()
