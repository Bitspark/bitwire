package dev.bitspark.bitwire;
/** Ground Ontos values, immutable hydrated tuples, or runtime-recognized sending faces. */
public sealed interface HydratedValue permits Value, HydratedTuple, HydratedWire {}
