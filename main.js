// Wires the table, graph and run panels together (run comes in step 4).

const badge = document.getElementById("kind-badge");
const staleNote = document.getElementById("stale-note");
const errorList = document.getElementById("errors");
const graphBox = document.getElementById("graph");

let graph = null; // created on first successful build

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

function onTableChange(m) {
  updateBadge(m);
  if (graph) staleNote.hidden = false;
}

function showErrors(errors) {
  errorList.replaceChildren(...errors.map((e) => {
    const li = document.createElement("li");
    li.textContent = e;
    return li;
  }));
  errorList.hidden = errors.length === 0;
}

function build() {
  const m = table.machine;
  const errors = Automaton.validate(m);
  showErrors(errors);
  if (errors.length) return;
  if (!graph) {
    graphBox.replaceChildren();
    graph = Graph.create(graphBox);
  }
  graph.draw(m);
  staleNote.hidden = true;
}

const table = Table.create(document.getElementById("table-container"), onTableChange);
updateBadge(table.machine);
document.getElementById("build-btn").addEventListener("click", build);
