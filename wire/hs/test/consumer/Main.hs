module Main (main) where

import Bitwire

main :: IO ()
main = do
  let access = AddressedWire
        { sendAddressed = \_ _ -> pure ()
        }
      primitive = Wire (\_ -> pure ())
      tree :: WireTree
      tree = DeixisNode primitive mempty select (NodeParts primitive mempty)
      select [] = Just tree
      select _ = Nothing
      message = Message (ProfileFrame (Trace Nothing Nothing) (Cancel mempty)) Nothing
  case at tree [] of
    Just selected -> send (own selected) message
    Nothing -> fail "the empty path did not select the root"
  first <- newReturnAddress access
  second <- newReturnAddress access
  if first == second
    then fail "distinct return capabilities were conflated"
    else putStrLn "Standalone consumer imported Bitwire and retained distinct identities."
