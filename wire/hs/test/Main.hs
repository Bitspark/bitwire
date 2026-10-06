module Main (main) where
import Bitwire
import qualified Data.ByteString as B
main :: IO ()
main = do
  let sender = Wire (\_ -> pure ())
  send sender (Atom B.empty)
  if ([] :: Path) == [B.empty] || Atom B.empty == Tuple [] then error "contract violation" else pure ()
