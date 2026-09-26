{-# LANGUAGE OverloadedStrings #-}

module Main (main) where

import Bitwire
import Control.Exception (try, IOException)
import Control.Monad (unless)
import qualified Data.ByteString as Bytes
import Data.IORef (newIORef, readIORef, modifyIORef')
import qualified Data.Map.Strict as Map

assert :: String -> Bool -> IO ()
assert label condition = unless condition (fail label)

-- Test-only finite materialization, not a production constructor in Bitwire.
node :: a -> Map.Map Key (DeixisNode a) -> DeixisNode a
node value branches = result
  where
    result = DeixisNode value branches select (NodeParts value branches)
    select [] = Just result
    select (key : rest) = Map.lookup key branches >>= (\child -> at child rest)

requireNode :: String -> Maybe (DeixisNode a) -> IO (DeixisNode a)
requireNode label = maybe (fail label) pure

main :: IO ()
main = do
  observed <- newIORef []
  let sink = AddressedWire
        { sendAddressed = \path message -> modifyIORef' observed ((path, message) :)
        }
      raw = JsonPayload "{\"integer\":9007199254740993,\"decimal\":0.1234567890123456789}"
      trace = Trace (Just "trace-parent") (Just "trace-state")
      request = ProfileFrame trace (Request "request-1" raw (Just (Map.singleton "x" "y")))
      paths = [[], [""], ["a/b"], ["a", "b"], ["\x1f680"], ["\xe9"], ["e\x0301"]]
  first <- newReturnAddress sink
  other <- newReturnAddress sink
  assert "distinct return addresses must not compare equal for one AddressedWire" (first /= other)
  let message = Message request (Just first)
  mapM_ (\path -> sendAddressed (returnWire first) path message) paths
  deliveries <- reverse <$> readIORef observed
  assert "opaque segment sequences must remain distinct" (map fst deliveries == paths)
  assert "routing copies must retain the return identity" (all ((== Just first) . messageReturn . snd) deliveries)
  assert "frames and raw JSON precision must be retained" (all ((== request) . messageFrame . snd) deliveries)
  assert "profile version is fixed" (profileVersion request == 1)
  assert "absent optional JSON must differ from present null"
    (ProfileError "invalid" "example" Nothing /=
     ProfileError "invalid" "example" (Just (JsonPayload "null")))
  let frames = [ request
               , ProfileFrame trace (Response "request-1" (Right raw))
               , ProfileFrame trace (Response "request-2" (Left (ProfileError "invalid" "example" (Just raw))))
               , ProfileFrame trace (Event raw Nothing)
               , ProfileFrame trace (Cancel "request-1")
               ]
  assert "all logical frame variants remain available"
    (map profileKind frames == [RequestKind, ResponseKind, ResponseKind, EventKind, CancelKind])
  let endpoint = Endpoint sink (\_ -> ioError (userError "fixture has no dispatcher")) (\_ _ -> pure ())
  refused <- try (receive endpoint (Receiver Nothing Nothing)) :: IO (Either IOException (IO ()))
  case refused of
    Left _ -> pure ()
    Right _ -> fail "fixture refusal should be observable through IO"
  sent <- newIORef []
  let primitive :: String -> Wire
      primitive label = Wire (\delivery -> modifyIORef' sent ((label, delivery) :))
      binaryKey = Bytes.pack [0, 255, 128]
      leaf = node (primitive "binary") Map.empty
      emptyLeaf = node (primitive "empty") Map.empty
      refusing = node (Wire (\_ -> ioError (userError "refused"))) Map.empty
      tree :: WireTree
      tree = node (primitive "root") (Map.fromList [(binaryKey, leaf), (Bytes.empty, emptyLeaf), ("refuse", refusing)])
  root <- requireNode "empty path selects the root" (at tree [])
  empty <- requireNode "empty key must remain a present child" (at tree [Bytes.empty])
  binary <- requireNode "arbitrary binary key must remain selectable" (at tree [binaryKey])
  mapM_ (\selected -> send (own selected) message) [root, empty, binary]
  treeDeliveries <- reverse <$> readIORef sent
  assert "selection chooses the node's addressless send capability"
    (map fst treeDeliveries == ["root", "empty", "binary"])
  assert "tree delivery preserves the message return capability"
    (all ((== Just first) . messageReturn . snd) treeDeliveries)
  assert "children returns the complete exact binary map"
    (Map.keys (children tree) == Map.keys (Map.fromList [(binaryKey, ()), (Bytes.empty, ()), ("refuse", ())]))
  assert "missing path is absent, not a root fallback" (case at tree ["missing"] of Nothing -> True; _ -> False)
  assert "a childless node has no descendants" (case at tree [binaryKey, "missing"] of Nothing -> True; _ -> False)
  refusedNode <- requireNode "a refusing child is present" (at tree ["refuse"])
  sendRefusal <- try (send (own refusedNode) message) :: IO (Either IOException ())
  assert "present refusing child remains observably different from missing"
    (case sendRefusal of Left _ -> True; _ -> False)
  let parts = decompose tree
      rebuilt = node (partsOwn parts) (partsChildren parts)
  rebuiltBinary <- requireNode "recomposition preserves exact keys" (at rebuilt [binaryKey])
  send (own rebuiltBinary) message
  afterRebuild <- readIORef sent
  assert "recomposition preserves original capability behavior"
    (case afterRebuild of (label, _) : _ -> label == "binary"; _ -> False)
  -- The same structural contract also holds a read primitive (a test IO action).
  let dataTree = node (pure (Bytes.pack [1, 2]) :: IO Bytes.ByteString) Map.empty
  dataRoot <- requireNode "the read lane uses the same structural selection" (at dataTree [])
  readBytes <- own dataRoot
  assert "the own payload operation determines reading versus sending" (readBytes == Bytes.pack [1, 2])
  putStrLn "Haskell contract value and consumer checks passed; runtime conformance is separate."
