module Main (main) where
import Bitwire
import qualified Data.ByteString as B
main :: IO ()
main = print (Envelope [] [B.pack [255]] B.empty (Just B.empty) (Tuple []))
