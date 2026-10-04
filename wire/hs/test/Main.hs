module Main (main) where
import Bitwire
import qualified Data.ByteString as B
main :: IO ()
main = do
  let e = Envelope [] [B.empty] B.empty Nothing (Tuple [Atom (B.pack [0,255])])
  if source e == destination e || Atom B.empty == Tuple [] then error "contract violation" else pure ()
