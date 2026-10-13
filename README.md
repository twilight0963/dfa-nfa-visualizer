# DFA/NFA String Visualizer

An interactive simulator for deterministic and nondeterministic finite automata.
Build a machine in a transition table, draw it as a state diagram, then feed it an
input string and watch the computation path animate step by step until the string
is accepted or rejected.

Simulator topic #7: *DFA/NFA String Processing Visualizer — animate state
transitions/computation paths and show acceptance/rejection.*

## Running

No build step or install needed. Open `index.html` in a browser.

The diagram uses [Cytoscape.js](https://js.cytoscape.org/). The page loads a local
`cytoscape.min.js` so it works offline, and falls back to the CDN if that file is
missing. The local copy is not committed; to get it on a fresh clone:

```sh
curl -o cytoscape.min.js https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.34.3/cytoscape.min.js
```

## Usage

### 1. Build the transition table

- **+ state** adds a row (states are auto-named `q0`, `q1`, …; click a name to rename it).
- **+** in the header adds an input symbol (a single character; click it to rename).
- **×** deletes a state or symbol. References to a deleted state are removed from every cell.
- Mark the **Start** state (radio) and any **Accept** states (checkbox).
- In each cell, type a target state and press **Tab** to add it. Keep typing and
  pressing Tab to add more targets (nondeterminism). **Tab** on an empty cell moves
  to the next cell, **Backspace** on an empty cell removes the last target.
  Targets that aren't existing states are shown in red.

The badge next to the title shows **DFA** when every cell has exactly one target,
and **NFA** otherwise.

### 2. Draw the machine

Press **Build**. The table is validated first (missing start state, unknown
targets, duplicate names, …) and any problems are listed. A valid machine is drawn
with a start arrow, double-ringed accepting states, and transitions between the
same pair of states merged into one edge (e.g. `a,b`). States can be dragged.

The run panel always uses the machine as of the last Build; if the table is edited
afterwards, a note asks you to build again.

### 3. Run a string

Type an input string and use **Step ▶** (or Enter), **◀ Back**, **Play/Pause** and
**Reset**; the slider sets playback speed.

| Colour | Meaning |
|---|---|
| Solid blue state | Currently active (an NFA can have several) |
| Thick blue edge | Transition taken on the last symbol |
| Light blue | Trail of states and edges visited so far |
| Green / red state | Final state that accepts / rejects |

The input tape highlights the symbol just read, the status line shows the current
set of active states, and the run ends with an **ACCEPT** or **REJECT** banner and
the reason: ended in an accepting state, ended with no accepting state, or no
transition available for the next symbol (remaining input is struck out).

### Example: strings containing `aa` (NFA)

| State | a | b |
|---|---|---|
| q0 (start) | q0, q1 | q0 |
| q1 | q2 | |
| q2 (accept) | q2 | q2 |

`baab` is accepted, `bab` is rejected.

## How it works

A machine is stored as a nested map from state to symbol to a list of target states:

```js
{
  states:    ["q0", "q1", "q2"],
  symbols:   ["a", "b"],
  start:     "q0",
  accepting: ["q2"],
  delta: { q0: { a: ["q0", "q1"], b: ["q0"] }, q1: { a: ["q2"], b: [] }, q2: { a: ["q2"], b: ["q2"] } }
}
```

Simulation tracks the **set** of active states. On each symbol, the next set is the
union of the targets of every active state. A DFA is the special case where each set
has exactly one state, so DFAs and NFAs share the same code. The run records every
step (active set and transitions taken), and the animation plays back that record,
which is why stepping backwards is free. The input is accepted if the final set
contains an accepting state. If the set becomes empty, the run stops early and the
input is rejected.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Page layout |
| `style.css` | Styles |
| `automaton.js` | Machine logic: DFA/NFA check, validation, simulation (no DOM) |
| `table.js` | Editable transition table |
| `graph.js` | State diagram drawing and the animated trail (Cytoscape.js) |
| `run.js` | Input tape, playback controls and accept/reject verdict |
| `main.js` | Connects the table, diagram and run panel |

Plain HTML, CSS and JavaScript; Cytoscape.js is the only dependency.
