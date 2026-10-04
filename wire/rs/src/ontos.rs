//! ontos/core (L0) — the frozen value model.
//!
//! ```text
//! Bytes = finite octet strings
//!
//! Value = Atom(Bytes)
//!       | Tuple(Value*)
//! ```
//!
//! A value is finite, immutable, well-founded (a finite tree, never cyclic),
//! uninterpreted, and compared by **structural identity**. This crate defines
//! *what a value is* and *when two values are the same* — nothing else. There is
//! no byte encoding here (that is `ontos-codec`) and no interpretation of atoms
//! or shapes (that is `ontos/compound` / `ontos/data` / a consumer).
//!
//! See `docs/spec/ontos-core.md`.
//!
//! # Common Value API (all three cores)
//!
//! The Go, Rust, and TypeScript cores expose the same conceptual surface so a
//! developer who learns one can predict the others. Every core provides, by its
//! own naming convention:
//!
//! - **Construct** — `Value::atom(bytes)` / `Value::tuple(items)`
//!   (Go `NewAtom`/`NewTuple`, TS `atom`/`tuple`).
//! - **Atom bytes + length** — [`Atom::bytes`] and [`Atom::len`].
//! - **Tuple children + arity + indexed access** — [`Tuple::items`],
//!   [`Tuple::len`], and [`Tuple::at`] (matching Go `Tuple.At` / TS `Tuple.at`).
//! - **Structural equality** — derived `PartialEq`/`Eq` (Go `Equal`, TS `equals`).
//! - **Diagnostic string** — the [`fmt::Display`] impl (Go `String`, TS `toString`),
//!   which is *not* a canonical encoding.
//!
//! # Intentional per-language extras
//!
//! Some members exist in only one core because they are idiomatic to that
//! language and have no natural cross-core analogue; they are intentional, not
//! accidental gaps:
//!
//! - **Rust** — [`Value::is_atom`], [`Value::is_tuple`], [`Value::as_atom`], and
//!   [`Value::as_tuple`]. Rust models `Value` as a closed `enum`, so these
//!   classify/borrow the variant without a `match`. Go reaches the same end with
//!   a type switch / type assertion on the `Value` interface, and TS with
//!   `instanceof` plus the `kind` discriminant — so neither needs parallel
//!   methods.
//! - **TypeScript** — a `kind` discriminant and `toJSON()`/`toHex()`. JavaScript
//!   lacks Rust enums and Go interfaces, so the discriminant restores exhaustive
//!   narrowing and `toJSON` gives structured-clone/JSON consumers a stable shape.
//!   Rust and Go have no runtime JSON contract to honor and so omit them.

use core::fmt;

/// A foundational ontos value: either opaque bytes (`Atom`) or a finite ordered
/// tuple of values (`Tuple`). These are the only two constructors.
///
/// Identity is structural: derived `PartialEq`/`Eq`/`Hash` compare atoms by exact
/// bytes and tuples elementwise by arity and order. `Atom` and `Tuple` are
/// disjoint, so `Atom(b)` is never equal to any `Tuple` (including
/// `Atom("") != Tuple()`).
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum Value {
    Atom(Atom),
    Tuple(Tuple),
}

/// An opaque finite byte string. The bytes have no built-in interpretation.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Atom {
    bytes: Vec<u8>,
}

/// A finite ordered tuple of values. Arity, order, and multiplicity are part of
/// the value's identity.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Tuple {
    items: Vec<Value>,
}

impl Value {
    /// Construct an atom from any byte source.
    pub fn atom<B: Into<Vec<u8>>>(bytes: B) -> Self {
        Self::Atom(Atom::new(bytes))
    }

    /// Construct a tuple from an iterator of child values.
    pub fn tuple<I>(items: I) -> Self
    where
        I: IntoIterator<Item = Value>,
    {
        Self::Tuple(Tuple::new(items))
    }

    /// Borrow as an `Atom`, or `None` if this is a `Tuple`.
    pub fn as_atom(&self) -> Option<&Atom> {
        match self {
            Self::Atom(atom) => Some(atom),
            Self::Tuple(_) => None,
        }
    }

    /// Borrow as a `Tuple`, or `None` if this is an `Atom`.
    pub fn as_tuple(&self) -> Option<&Tuple> {
        match self {
            Self::Atom(_) => None,
            Self::Tuple(tuple) => Some(tuple),
        }
    }

    /// True if this value is an atom.
    pub fn is_atom(&self) -> bool {
        matches!(self, Self::Atom(_))
    }

    /// True if this value is a tuple.
    pub fn is_tuple(&self) -> bool {
        matches!(self, Self::Tuple(_))
    }
}

impl Atom {
    pub fn new<B: Into<Vec<u8>>>(bytes: B) -> Self {
        Self {
            bytes: bytes.into(),
        }
    }

    /// The exact uninterpreted bytes of this atom.
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    pub fn len(&self) -> usize {
        self.bytes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.bytes.is_empty()
    }
}

impl Tuple {
    pub fn new<I>(items: I) -> Self
    where
        I: IntoIterator<Item = Value>,
    {
        Self {
            items: items.into_iter().collect(),
        }
    }

    /// The tuple's ordered children.
    pub fn items(&self) -> &[Value] {
        &self.items
    }

    /// The arity (number of children).
    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    /// Borrow child `i`, or `None` if `i` is out of range. The safe indexed
    /// accessor in the common core API, matching Go `Tuple.At` and TS
    /// `Tuple.at`; for the whole slice (and iteration) use [`items`](Self::items).
    pub fn at(&self, i: usize) -> Option<&Value> {
        self.items.get(i)
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Value::Atom(atom) => {
                write!(f, "Atom(0x")?;
                for byte in atom.bytes() {
                    write!(f, "{byte:02x}")?;
                }
                write!(f, ")")
            }
            Value::Tuple(tuple) => {
                write!(f, "Tuple(")?;
                for (index, item) in tuple.items().iter().enumerate() {
                    if index != 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{item}")?;
                }
                write!(f, ")")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atoms_compare_by_exact_bytes() {
        assert_eq!(Value::atom(vec![1, 2, 3]), Value::atom(vec![1, 2, 3]));
        assert_ne!(Value::atom(vec![1, 2, 3]), Value::atom(vec![1, 2, 4]));
    }

    #[test]
    fn atom_length_is_significant() {
        assert_ne!(Value::atom(vec![1]), Value::atom(vec![0, 1]));
    }

    #[test]
    fn empty_atom_and_empty_tuple_are_distinct() {
        assert_ne!(
            Value::atom(Vec::<u8>::new()),
            Value::tuple(Vec::<Value>::new())
        );
    }

    #[test]
    fn tuples_compare_structurally() {
        let a = Value::tuple(vec![Value::atom(vec![0x61]), Value::atom(vec![0x62])]);
        let b = Value::tuple(vec![Value::atom(vec![0x61]), Value::atom(vec![0x62])]);
        let swapped = Value::tuple(vec![Value::atom(vec![0x62]), Value::atom(vec![0x61])]);
        assert_eq!(a, b);
        assert_ne!(a, swapped);
    }

    #[test]
    fn nesting_is_significant() {
        let nested = Value::tuple(vec![Value::tuple(vec![
            Value::atom(vec![0x61]),
            Value::atom(vec![0x62]),
        ])]);
        let flat = Value::tuple(vec![Value::atom(vec![0x61]), Value::atom(vec![0x62])]);
        assert_ne!(nested, flat);
    }

    #[test]
    fn tuple_at_returns_children_in_order() {
        let first = Value::atom(vec![0x61]);
        let second = Value::atom(vec![0x62]);
        let t = Tuple::new(vec![first.clone(), second.clone()]);
        assert_eq!(t.len(), 2);
        assert!(!t.is_empty());
        assert_eq!(t.at(0), Some(&first));
        assert_eq!(t.at(1), Some(&second));
        // at() agrees with the items() slice at the same index.
        assert_eq!(t.at(0), t.items().first());
    }

    #[test]
    fn tuple_at_out_of_range_is_none() {
        let t = Tuple::new(vec![Value::atom(vec![0x61])]);
        assert_eq!(t.at(1), None);
        let empty = Tuple::new(Vec::<Value>::new());
        assert!(empty.is_empty());
        assert_eq!(empty.len(), 0);
        assert_eq!(empty.at(0), None);
    }

    #[test]
    fn atom_len_and_is_empty() {
        let a = Atom::new(vec![1, 2, 3]);
        assert_eq!(a.len(), 3);
        assert!(!a.is_empty());
        let empty = Atom::new(Vec::<u8>::new());
        assert_eq!(empty.len(), 0);
        assert!(empty.is_empty());
    }

    #[test]
    fn reflection_helpers_classify_and_borrow() {
        let a = Value::atom(vec![0x61]);
        let t = Value::tuple(vec![Value::atom(vec![0x62])]);
        assert!(a.is_atom() && !a.is_tuple());
        assert!(t.is_tuple() && !t.is_atom());
        assert_eq!(a.as_atom().map(Atom::len), Some(1));
        assert!(a.as_tuple().is_none());
        assert_eq!(t.as_tuple().map(Tuple::len), Some(1));
        assert!(t.as_atom().is_none());
    }
}
