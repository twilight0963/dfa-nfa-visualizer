// Wires the table, graph and run panels together (graph and run come in steps 3–4).

const badge = document.getElementById("kind-badge");

function updateBadge(m) {
  if (m.states.length === 0 || m.symbols.length === 0) {
    badge.textContent = "";
    return;
  }
  const kind = Automaton.kind(m);
  badge.textContent = kind;
  badge.className = `badge ${kind.toLowerCase()}`;
  badge.title = kind === "DFA"
    ? "Every cell has exactly one target"
    : "Some cell has zero or several targets";
}

const table = Table.create(document.getElementById("table-container"), updateBadge);
updateBadge(table.machine);
