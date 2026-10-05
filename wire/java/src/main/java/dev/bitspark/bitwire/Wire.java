package dev.bitspark.bitwire;
import java.util.concurrent.CompletionStage;
public interface Wire { CompletionStage<Void> send(Value message); }
