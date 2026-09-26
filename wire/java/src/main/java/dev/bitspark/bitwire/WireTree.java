package dev.bitspark.bitwire;

/**
 * A full Deixis structure whose own values are addressless {@link Wire}
 * capabilities. This is the Java specialization of {@code DeixisNode<Wire>}.
 *
 * <p>Sending at an existing binary path means selecting that node and invoking
 * {@code selected.own().send(message)}. A missing node is a selection failure,
 * distinct from admission refusal by the selected Wire. No generic send method
 * substitutes for the complete structural operations inherited here.
 */
public interface WireTree extends DeixisNode<Wire> {}
