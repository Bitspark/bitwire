# Poster design

The editorial and visual contract for [the poster](index.html). Facts come from
[SEAM.md](SEAM.md); this file decides what a reader sees, in what order, and
why it looks the way it does.

## Editorial contract

### Primary reader

A **new consumer**: an engineer writing a runtime, a generator, or code that
assembles components, who is deciding whether to target Bitwire and how to
attach. Operators and contributors are served only in the closing appendix.

### Plain-language proposition

> One interface for sending a message to a path. Components that speak it can
> be plugged into larger systems without knowing where they were plugged in.

### Differentiator

> Plugging in is exact: selecting a path or mounting components gives back the
> same interface, under written laws that eight language packages share and
> that independent test cases check against a production runtime.

### Reading passes

- **Five seconds.** Bitwire; one method, `send(path, message)`; composing
  access gives the same access back.
- **Thirty seconds.** What a path is (opaque segments); one send descending an
  assembly, losing one segment per boundary, while the reply returns straight to
  the caller; install for TypeScript or Go; "send means admitted, not done".
- **Five minutes.** A compiled example with its output; the four rules; where
  Bitwire stops and who supplies the runtime; how the promise is checked and
  what is still open; three next actions.

### Content budget

- **Central claim.** Composed access is the same access again.
- **Proof points (4).** Opaque paths; declared composites (origin at `[]`,
  complete children, no fallback); eight doors, one written meaning; independent
  cases against a production runtime.
- **Primary attachment.** TypeScript and Go side by side; the six other doors
  are a subordinate list.
- **One interaction.** The send-only `at` in TypeScript, verified.
- **Rules (4).** Send is admission; one receiver per endpoint; handing out a
  Wire hands out sending only; pass messages on, never rebuild them.
- **Next actions (3).** Install; read the contract; run the bookshop.

Subordinated to the appendix: the frame field table, the full list of
declared-composite laws, native method spellings, and contributor commands.
Omitted entirely: publication run links, the historical 0.1 baseline,
invocation-lifecycle internals from decision 0003, request-serial rules, and the
Deixis key-mapping detail. They are true, but a consumer does not need them to
decide or attach, and they live in `SEAM.md` and the linked documents.

### Storyboard

| Beat | Reader question | One-sentence answer | Evidence | Representation | Priority |
| --- | --- | --- | --- | --- | --- |
| 1 Seam | What is this? | One method sends a message to a path; an owner may also receive and close. | `wire/ts/src/index.ts:89-103` | Hero: proposition, interface block with its capability split | 5 s |
| 2 Thesis | Why is it different? | Selecting twice is selecting once, and the result is a Wire again. | `docs/wire/contract.md:136-140` | Law drawn as strips in the hero | 5 s |
| 3 Paths | What is a path? | A strip of opaque segments: four look-alikes are four different paths. | `docs/wire/contract.md:38-41` | Specimen legend, which also teaches how to read every strip | 30 s |
| 4 Descent | What happens when I compose? | Each boundary tears off exactly one segment; the component sees only its own relative path; the reply bypasses every boundary. | `docs/wire/contract.md:45-50,152-156,205-207` | The central strip descent, laws as captions | 30 s |
| 5 Composite | What does a node do at `[]`? | Its origin answers `[]`; a missing child refuses and never falls back. | `docs/wire/contract.md:160-179` | Three sends to the same shop, as strips with outcomes | 30 s |
| 6 Attach | How do I attach? | Depend on the declarations; write or obtain `at`; get endpoints from a runtime. | `wire/ts/README.md:29-52`, `wire/go/README.md:102` | Install lines, compiled example, output; six other doors | 30 s / 5 min |
| 7 Rules | What changes how I build? | Admission is not completion; one receiver; sending only; never rebuild. | `docs/wire/contract.md:17-21,61-71,205-229` | Four numbered statements | 5 min |
| 8 Limits | What does it not do? | No runtime, transport, generator, new protocol or authentication; a shared signature is not interoperability. | `README.md:22,72-80`; `docs/wire/profile.md:4-6,114-123` | Dependency diagram and a "not here" list | 5 min |
| 9 Evidence | Why trust it? | Cases authored here run against Nightseam's production endpoints; exact gaps are recorded; #20 is open. | `conformance/README.md:8-26` | Case strips, 39 cells each | 5 min |
| 10 Next | What now? | Install, read the contract, run the bookshop. | `examples/README.md:13-20` | Three actions with commands and links | 5 min |

## Visual identity

### Thesis

Bitwire is the written meaning of one method (send a message to a relative
path), and its value is that composed access is the same access again: nothing
is added, rebuilt or leaked on the way down.

### Candidate directions

1. **Segment strip (chosen).** From "a path is a sequence of opaque Unicode
   scalar strings; `[]`, `[""]`, `["a/b"]` and `["a", "b"]` are different paths"
   (`docs/wire/contract.md:38-41`) and "mounting ... uses exactly one segment and
   removes it" (`:47-48`). Every path is a strip of discrete cells with
   perforated boundaries. Composition is strip arithmetic: selection splices
   cells onto the front; each mount boundary tears one cell off. Hierarchy
   follows the strip: the thing that moves is the thing the eye follows.
2. **Equational plate.** From the numbered law sets (`S0`–`V`,
   `docs/decisions/0006-declared-composites-realize-deixis-nodes.md:305-323`):
   a formal specification sheet with commutative diagrams. **Rejected:** it greets
   a new consumer with notation before showing a message move, and a commuting
   square hides the mechanism (one segment consumed per level) that makes the
   laws true.
3. **Postal sorting office.** From `ReturnAddress` and relative delivery: letters
   whose address shortens at each sorting stage. **Rejected:** the contract says a
   Wire "is access to an origin, not a serialized address"
   (`docs/wire/contract.md:29`) and local capabilities are "never serialized"
   (`:228-229`). A postal metaphor would teach exactly the misconception the
   contract forbids: that the address and the return address travel as data.

### Derivation

- Because paths are sequences of opaque segments where a slash is just a
  character and the empty string is a segment (`contract.md:38-41`), **every
  path is drawn as a strip of cells**: `["a/b"]` is visibly one cell, `[""]` a
  visibly empty cell, `[]` only the origin mark.
- Because mounting consumes exactly one segment and selection prepends a prefix
  (`contract.md:45-50`), **the central figure is a descent in which each boundary
  tears one stub off the strip**, so the received path is visibly shorter than
  the sent one.
- Because a component sees only paths relative to its own origin and never
  learns its mount point (`contract.md:69-70`, `composition.md:24-27`), **colour
  has two path roles only**: the assembly's cells (ochre) and the cells the
  component still sees (cobalt).
- Because refusal is a first-class, observable outcome (a refusing origin is a
  value; a missing child refuses; a second attachment is refused;
  `contract.md:67-68,163-164,178-179`), **one colour, vermilion, means refused
  and appears nowhere else**.
- Because the reply uses the message's own return capability, which composition
  never rebuilds (`contract.md:205-207,216-218`), **the reply is the one line in
  the figure that crosses every boundary without tearing**.
- Because Wire grants sending only and handing it out grants no ownership
  (`contract.md:17-21`), **the interface is set as two bands**: `send` dominant,
  `receive`/`close` in a subordinate owner-only band.

### System

**Type roles.**

| Role | Stack | Used for |
| --- | --- | --- |
| Label | Bahnschrift (semi-condensed), Avenir Next Condensed, Roboto Condensed, Arial Narrow, sans-serif | Name, section heads, strip level labels, small caps kickers. Condensed so labels sit beside strips without crowding. |
| Reading | Charter, Sitka Text, Iowan Old Style, Georgia, serif | All sustained prose and captions; laws in its italic. |
| Segment | Cascadia Mono, SF Mono, ui-monospace, Menlo, Consolas, monospace | Segment text inside cells, and code. Nothing else. |

**Palette.** Every colour has one meaning.

| Token | Value | Meaning |
| --- | --- | --- |
| `--paper` | `#f5f2eb` | Page. Card stock, not screen white. |
| `--ink` | `#1c1d21` | Text, cell outlines, the reply line, passing case cells. |
| `--ink-2` | `#54575f` | Secondary text. |
| `--rule` | `#cbc3b2` | Perforations, dividers, boundaries. |
| `--outer` / `--outer-tint` | `#9a5b0b` / `#f1dfbd` | Cells belonging to the assembly: a prefix added by selection, a stub torn off by a mount. |
| `--rel` / `--rel-tint` | `#2344a0` / `#dde4f6` | Cells the receiving component still sees. |
| `--refuse` / `--refuse-tint` | `#b3321f` / `#f5d8d1` | Refused. Only refusal. |

Colour never carries meaning alone: outer cells also carry a torn edge or a `+`
splice mark, refused outcomes carry the word "refused" and a struck mark, and
recorded gaps are hatched rather than coloured.

**Grid and measure.** Content column to 1200 px; prose measure at most 66 ch.
The descent is a three-track grid: level label, strip, note.

**Mark language.** Cells: 1.5 px ink outline, square corners, perforated
(dashed) internal boundaries. The origin mark: a heavy vertical bar starting
each strip. The torn stub: a zigzag edge cut on the consumed cell. The splice:
a small `+` joining prefix cells. Boundaries: hairline rules across the descent.
No rounded cards, shadows or gradients.

**Density.** Strips, cells and code may be compact. Prose, rules and the
descent notes stay spacious. The appendix may be dense and is collapsed.

**Motion.** None. The descent is legible static; animating it would add
nothing a reader cannot see from the stacked strips.

**Responsive transformation.**

| Region | ≥ 1100 px | 700–1099 px | < 700 px |
| --- | --- | --- | --- |
| Hero | Text 7 / seam card 5 | Stacked | Stacked |
| Nav strip | One row of cells | One row, scrolls within itself | Scrolls within itself, fade edge |
| Path legend | Four specimens in a row | 2 × 2 | 2 × 2, narrower cells |
| Descent | Label, strip, note in three tracks | Label over strip, note beside | Label, strip and note stacked on a left spine |
| Three sends | Strip, arrow, outcome in a row | Same | Strip over outcome |
| Attach | TypeScript and Go side by side | Stacked | Stacked; the TypeScript example is kept to 45 characters a line so it fits. The Go declaration and the pinned `git checkout` line scroll inside their block, with shadow edges as the affordance |
| Evidence strips | 39 cells in one row | 39 cells in one row | Rows of 13 |
| Appendix spelling table | Four columns | Four columns | One block per language, labelled Send / Receive / Close |

### Identity invariants

Preserve these in every refinement:

- Paths drawn as strips of perforated cells, with the origin bar; `[]` is the
  bar alone, `[""]` an empty cell.
- The descent: one torn stub per boundary, the reply line uncut.
- Two path colours (assembly, still-seen) and one refusal colour, each with a
  single meaning.
- Condensed labels, serif reading text, mono only for segments and code.
- The navigation is itself a strip of cells.
- Paper-and-ink restraint: no rounded cards, shadows or gradients.

### Free to change

Exact hex values, font stacks, spacing, section order after the descent, the
wording of rules, the number of evidence rows, and whether the appendix is one
or several `<details>`.
