package dev.bitspark.bitwire;
public sealed interface Value extends HydratedValue permits Atom, Tuple {}
