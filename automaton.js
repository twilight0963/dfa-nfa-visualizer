// Pure automaton logic: no DOM. Loaded as a classic <script> (global `Automaton`)
// and via require() in Node for tests.
//
// Machine shape:
// {
//   states:    ["q0", "q1"],
//   symbols:   ["a", "b"],
//   start:     "q0",
//   accepting: ["q1"],
//   delta:     { q0: { a: ["q0", "q1"], b: [] }, q1: { a: [], b: [] } }
// }

const Automaton = (() => {
  function targets(m, state, symbol) {
    return (m.delta[state] && m.delta[state][symbol]) || [];
  }

  // DFA iff every (state, symbol) cell has exactly one target.
  function kind(m) {
    for (const s of m.states) {
      for (const a of m.symbols) {
        if (targets(m, s, a).length !== 1) return "NFA";
      }
    }
    return "DFA";
  }

  function duplicates(list) {
    return list.filter((x, i) => list.indexOf(x) !== i);
  }

  // Returns a list of human-readable error strings; empty means valid.
  function validate(m, input = "") {
    const errors = [];
    if (m.states.length === 0) errors.push("Add at least one state.");
    if (m.symbols.length === 0) errors.push("Add at least one symbol.");

    if (m.states.some((s) => s.trim() === "")) errors.push("State names cannot be empty.");
    if (m.symbols.some((a) => a.trim() === "")) errors.push("Symbols cannot be empty.");
    for (const a of m.symbols) {
      if (a.length > 1) errors.push(`Symbol "${a}" must be a single character.`);
    }
    for (const s of new Set(duplicates(m.states))) errors.push(`Duplicate state "${s}".`);
    for (const a of new Set(duplicates(m.symbols))) errors.push(`Duplicate symbol "${a}".`);

    if (!m.start) errors.push("Choose a start state.");
    else if (!m.states.includes(m.start)) errors.push(`Start state "${m.start}" does not exist.`);

    for (const f of m.accepting) {
      if (!m.states.includes(f)) errors.push(`Accepting state "${f}" does not exist.`);
    }

    for (const s of m.states) {
      for (const a of m.symbols) {
        for (const t of targets(m, s, a)) {
          if (!m.states.includes(t)) errors.push(`δ(${s}, ${a}) → "${t}" is not a state.`);
        }
      }
    }

    for (const c of new Set(input)) {
      if (!m.symbols.includes(c)) errors.push(`Input symbol "${c}" is not in the alphabet.`);
    }
    return errors;
  }

  // Runs the machine on `input` and records every step.
  // Each step: { index, symbol, active, edges } where `active` is the state set
  // after consuming `symbol` and `edges` are the [from, symbol, to] moves taken.
  // Step 0 is the initial configuration (symbol null, no edges).
  // If the active set becomes empty the run stops early (`deadAt` = input index).
  function simulate(m, input) {
    let active = [m.start];
    const steps = [{ index: -1, symbol: null, active, edges: [] }];
    let deadAt = null;

    for (let i = 0; i < input.length; i++) {
      const symbol = input[i];
      const edges = [];
      const next = [];
      for (const s of active) {
        for (const t of targets(m, s, symbol)) {
          edges.push([s, symbol, t]);
          if (!next.includes(t)) next.push(t);
        }
      }
      active = next;
      steps.push({ index: i, symbol, active, edges });
      if (active.length === 0) {
        deadAt = i;
        break;
      }
    }

    const accepted = deadAt === null && active.some((s) => m.accepting.includes(s));
    return { steps, accepted, deadAt };
  }

  return { kind, validate, simulate };
})();

if (typeof module !== "undefined") module.exports = Automaton;
