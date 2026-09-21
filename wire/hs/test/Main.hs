{-# LANGUAGE OverloadedStrings #-}

module Main (main) where

import Bitwire
import Control.Exception (try, IOException)
import Control.Monad (unless)
import Data.IORef (newIORef, readIORef, modifyIORef')
import qualified Data.Map.Strict as Map

assert :: String -> Bool -> IO ()
assert label condition = unless condition (fail label)

main :: IO ()
main = do
  observed <- newIORef []
  let sink = Wire
        { send = \path message -> modifyIORef' observed ((path, message) :)
        }
      raw = JsonPayload "{\"integer\":9007199254740993,\"decimal\":0.1234567890123456789}"
      trace = Trace (Just "trace-parent") (Just "trace-state")
      request = ProfileFrame trace (Request "request-1" raw (Just (Map.singleton "x" "y")))
      paths = [[], [""], ["a/b"], ["a", "b"], ["\x1f680"], ["\xe9"], ["e\x0301"]]
  first <- newReturnAddress sink
  other <- newReturnAddress sink
  assert "distinct return addresses must not compare equal for one Wire" (first /= other)
  let message = Message request (Just first)
  mapM_ (\path -> send (returnWire first) path message) paths
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
  putStrLn "Haskell contract value and consumer checks passed; runtime conformance is separate."
