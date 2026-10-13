// Editable transition table. Owns the machine object, mutates it in place,
// and calls onChange(machine) after every edit.
//
// Structural edits (add/delete state or symbol) re-render the whole table.
// Renames and chip edits only touch the affected cells so typing focus is kept.

const Table = (() => {
  const SYMBOL_POOL = "abcdefghijklmnopqrstuvwxyz0123456789";

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v);
    }
    node.append(...children);
    return node;
  }

  function nextStateName(used) {
    let n = 0;
    while (used.includes(`q${n}`)) n++;
    return `q${n}`;
  }

  function nextSymbol(used) {
    return [...SYMBOL_POOL].find((c) => !used.includes(c)) || "";
  }

  function flashInvalid(input, message) {
    input.classList.add("invalid");
    input.title = message;
    setTimeout(() => {
      input.classList.remove("invalid");
      input.title = "";
    }, 1500);
  }

  function create(container, onChange) {
    const m = {
      states: ["q0"],
      symbols: ["a", "b"],
      start: "q0",
      accepting: [],
      delta: { q0: { a: [], b: [] } },
    };
    // "i,j" -> { chips, input } for the cell of state i, symbol j.
    let cells = new Map();

    const changed = () => onChange(m);
    const forEachCell = (fn) => {
      for (const s of m.states) for (const a of m.symbols) fn(m.delta[s][a]);
    };

    // ---- states ----

    function addState() {
      const name = nextStateName(m.states);
      m.states.push(name);
      m.delta[name] = Object.fromEntries(m.symbols.map((a) => [a, []]));
      if (!m.start) m.start = name;
      render();
      focus(`.state-name[data-i="${m.states.length - 1}"]`);
      changed();
    }

    function deleteState(i) {
      const name = m.states[i];
      m.states.splice(i, 1);
      delete m.delta[name];
      forEachCell((list) => {
        const k = list.indexOf(name);
        if (k !== -1) list.splice(k, 1);
      });
      if (m.start === name) m.start = "";
      m.accepting = m.accepting.filter((s) => s !== name);
      render();
      changed();
    }

    function renameState(i, input) {
      const old = m.states[i];
      const name = input.value.trim();
      if (name === old) return;
      if (!name || m.states.includes(name)) {
        input.value = old;
        flashInvalid(input, name ? `"${name}" already exists` : "Name cannot be empty");
        return;
      }
      input.value = name;
      m.states[i] = name;
      m.delta[name] = m.delta[old];
      delete m.delta[old];
      forEachCell((list) => {
        const k = list.indexOf(old);
        if (k !== -1) list[k] = name;
      });
      if (m.start === old) m.start = name;
      m.accepting = m.accepting.map((s) => (s === old ? name : s));
      refreshCells();
      changed();
    }

    function toggleAccepting(i, on) {
      const name = m.states[i];
      m.accepting = m.accepting.filter((s) => s !== name);
      if (on) m.accepting.push(name);
      changed();
    }

    // ---- symbols ----

    function addSymbol() {
      const sym = nextSymbol(m.symbols);
      if (!sym) return;
      m.symbols.push(sym);
      for (const s of m.states) m.delta[s][sym] = [];
      render();
      focus(`.symbol-name[data-j="${m.symbols.length - 1}"]`);
      changed();
    }

    function deleteSymbol(j) {
      const sym = m.symbols[j];
      m.symbols.splice(j, 1);
      for (const s of m.states) delete m.delta[s][sym];
      render();
      changed();
    }

    function renameSymbol(j, input) {
      const old = m.symbols[j];
      const sym = input.value.trim();
      if (sym === old) return;
      if (!sym || m.symbols.includes(sym)) {
        input.value = old;
        flashInvalid(input, sym ? `"${sym}" already exists` : "Symbol cannot be empty");
        return;
      }
      m.symbols[j] = sym;
      for (const s of m.states) {
        m.delta[s][sym] = m.delta[s][old];
        delete m.delta[s][old];
      }
      changed();
    }

    // ---- cells ----

    function cellList(i, j) {
      return m.delta[m.states[i]][m.symbols[j]];
    }

    function renderChips(i, j) {
      const { chips } = cells.get(`${i},${j}`);
      const list = cellList(i, j);
      chips.replaceChildren(
        ...list.map((t, k) =>
          el("span", { className: m.states.includes(t) ? "chip" : "chip unknown",
                       title: m.states.includes(t) ? "" : `"${t}" is not a state` },
            t,
            el("button", {
              type: "button", className: "chip-x", tabIndex: -1, textContent: "×",
              "aria-label": `Remove ${t}`,
              onclick: () => { list.splice(k, 1); renderChips(i, j); changed(); },
            }))));
    }

    function refreshCells() {
      for (const key of cells.keys()) {
        const [i, j] = key.split(",").map(Number);
        renderChips(i, j);
      }
    }

    // Turns the typed text into chips. Accepts "q1", or several like "q1, q2".
    function commit(i, j, input) {
      const list = cellList(i, j);
      for (const t of input.value.split(/[\s,]+/).filter(Boolean)) {
        if (!list.includes(t)) list.push(t);
      }
      input.value = "";
      input.classList.remove("unknown");
      renderChips(i, j);
      changed();
    }

    function onCellKey(e, i, j) {
      const input = e.target;
      const hasText = input.value.trim() !== "";
      if ((e.key === "Tab" && !e.shiftKey && hasText) || e.key === "Enter") {
        e.preventDefault();
        if (hasText) commit(i, j, input);
      } else if (e.key === "Backspace" && !hasText && cellList(i, j).length) {
        cellList(i, j).pop();
        renderChips(i, j);
        changed();
      }
    }

    function cell(i, j) {
      const chips = el("span", { className: "chips" });
      const input = el("input", {
        className: "chip-input", size: 3, "aria-label": `δ(${m.states[i]}, ${m.symbols[j]})`,
        onkeydown: (e) => onCellKey(e, i, j),
        oninput: () => {
          const t = input.value.trim();
          input.classList.toggle("unknown", t !== "" && !/[\s,]/.test(t) && !m.states.includes(t));
        },
        onblur: () => { if (input.value.trim()) commit(i, j, input); },
      });
      cells.set(`${i},${j}`, { chips, input });
      const box = el("div", { className: "cell-box", onclick: () => input.focus() }, chips, input);
      return el("td", { className: "cell" }, box);
    }

    // ---- rendering ----

    function focus(selector) {
      const node = container.querySelector(selector);
      if (node) { node.focus(); node.select?.(); }
    }

    function deleteButton(label, onclick) {
      return el("button", { type: "button", className: "del", textContent: "×",
                            title: label, "aria-label": label, onclick });
    }

    function render() {
      cells = new Map();

      const head = el("tr", {},
        el("th", {}, "State"),
        el("th", { title: "Start state" }, "Start"),
        el("th", { title: "Accepting state" }, "Accept"),
        ...m.symbols.map((a, j) => el("th", { className: "symbol-head" },
          el("input", {
            className: "symbol-name", value: a, maxLength: 1, size: 1, "data-j": j,
            "aria-label": `Symbol ${a}`,
            onchange: (e) => renameSymbol(j, e.target),
          }),
          deleteButton(`Delete symbol ${a}`, () => deleteSymbol(j)))),
        el("th", {},
          el("button", { type: "button", className: "add", textContent: "+",
                         title: "Add symbol", onclick: addSymbol })));

      const rows = m.states.map((s, i) => el("tr", {},
        el("td", { className: "state-cell" },
          deleteButton(`Delete state ${s}`, () => deleteState(i)),
          el("input", {
            className: "state-name", value: s, size: 4, "data-i": i,
            "aria-label": `State ${s}`,
            onchange: (e) => renameState(i, e.target),
          })),
        el("td", { className: "center" },
          el("input", { type: "radio", name: "start", checked: m.start === s,
                        "aria-label": `${s} is start`,
                        onchange: () => { m.start = m.states[i]; changed(); } })),
        el("td", { className: "center" },
          el("input", { type: "checkbox", checked: m.accepting.includes(s),
                        "aria-label": `${s} is accepting`,
                        onchange: (e) => toggleAccepting(i, e.target.checked) })),
        ...m.symbols.map((_, j) => cell(i, j)),
        el("td")));

      const addRow = el("tr", {},
        el("td", { colSpan: m.symbols.length + 4 },
          el("button", { type: "button", className: "add", textContent: "+ state",
                         title: "Add state", onclick: addState })));

      container.replaceChildren(
        el("table", { className: "transitions" },
          el("thead", {}, head), el("tbody", {}, ...rows, addRow)));
      refreshCells();
    }

    render();
    return { machine: m };
  }

  return { create };
})();
