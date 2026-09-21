module Main (main) where

import Bitwire

main :: IO ()
main = do
  let access = Wire
        { send = \_ _ -> pure ()
        }
  first <- newReturnAddress access
  second <- newReturnAddress access
  if first == second
    then fail "distinct return capabilities were conflated"
    else putStrLn "Standalone consumer imported Bitwire and retained distinct identities."
