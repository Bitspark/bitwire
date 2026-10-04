package dev.bitspark.bitwire;
public record Termination(Kind kind, String message) { public enum Kind { CLOSED, FAILED } }
