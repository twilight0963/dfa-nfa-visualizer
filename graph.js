// Draws a machine with Cytoscape. Transitions between the same pair of states
// are merged into one edge labelled "a,b". A hidden node points at the start state.

const Graph = (() => {
  const START = "__start";

  const style = [
    { selector: "node", style: {
      "label": "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      "width": 46,
      "height": 46,
      "background-color": "#ffffff",
      "border-width": 2,
      "border-color": "#1d1d24",
      "font-size": 14,
      "color": "#1d1d24",
      "transition-property": "background-color, border-color, color",
      "transition-duration": 0.25,
    } },
    { selector: "node.accepting", style: {
      "border-style": "double",
      "border-width": 6,
    } },
    { selector: `#${START}`, style: {
      "width": 1, "height": 1, "opacity": 0, "events": "no", "label": "",
    } },
    { selector: "edge", style: {
      "label": "data(label)",
      "curve-style": "bezier",
      "control-point-step-size": 40,
      "target-arrow-shape": "triangle",
      "arrow-scale": 1.2,
      "width": 1.5,
      "line-color": "#6b6b78",
      "target-arrow-color": "#6b6b78",
      "font-size": 13,
      "color": "#1d1d24",
      "text-background-color": "#ffffff",
      "text-background-opacity": 1,
      "text-background-padding": 2,
      "loop-direction": "-45deg",
      "loop-sweep": "-60deg",
      "transition-property": "line-color, target-arrow-color, width",
      "transition-duration": 0.25,
    } },
    { selector: "edge.start-arrow", style: { "label": "" } },

    // Run trail: visited (faded) < taken / active (now) < final verdict.
    { selector: "node.visited", style: { "background-color": "#dbe5fd", "border-color": "#7d9cf5" } },
    { selector: "edge.visited", style: {
      "line-color": "#9db4fa", "target-arrow-color": "#9db4fa", "width": 2.5,
    } },
    { selector: "edge.taken", style: {
      "line-color": "#3b6ef5", "target-arrow-color": "#3b6ef5", "width": 4,
    } },
    { selector: "node.active", style: {
      "background-color": "#3b6ef5", "border-color": "#1f3fa8", "color": "#ffffff",
    } },
    { selector: "node.final-accept", style: {
      "background-color": "#1f9d55", "border-color": "#146c3a", "color": "#ffffff",
    } },
    { selector: "node.final-reject", style: {
      "background-color": "#d64545", "border-color": "#9b2c2c", "color": "#ffffff",
    } },
  ];

  const RUN_CLASSES = "visited taken active final-accept final-reject";

  function create(container) {
    const cy = cytoscape({ container, style, wheelSensitivity: 0.2, maxZoom: 1.6 });
    let nodeIds = new Map(); // state name -> node id
    let edgeIds = new Map(); // "fromId>toId" -> edge id

    function draw(m) {
      nodeIds = new Map(m.states.map((s, i) => [s, `n${i}`]));
      edgeIds = new Map();

      const nodes = m.states.map((s) => ({
        data: { id: nodeIds.get(s), label: s },
        classes: m.accepting.includes(s) ? "accepting" : "",
      }));

      // (from, to) -> symbols, in table order.
      const merged = new Map();
      for (const s of m.states) {
        for (const a of m.symbols) {
          for (const t of m.delta[s][a]) {
            const key = `${nodeIds.get(s)}>${nodeIds.get(t)}`;
            if (!merged.has(key)) merged.set(key, []);
            if (!merged.get(key).includes(a)) merged.get(key).push(a);
          }
        }
      }
      const edges = [...merged].map(([key, symbols], i) => {
        const [source, target] = key.split(">");
        edgeIds.set(key, `e${i}`);
        return { data: { id: `e${i}`, source, target, label: symbols.join(",") } };
      });

      const startEdge = { data: { id: "start-edge", source: START, target: nodeIds.get(m.start) },
                          classes: "start-arrow" };

      cy.elements().remove();
      cy.add([...nodes, { data: { id: START } }, ...edges, startEdge]);

      // States on a circle, start state on the left, the rest in BFS order clockwise.
      // A circle keeps every edge clear of other states, unlike a row of states.
      const order = bfsOrder(m).map((s) => cy.getElementById(nodeIds.get(s)));
      const states = cy.collection(order);
      states.layout({
        name: "circle",
        startAngle: Math.PI,
        radius: Math.max(110, m.states.length * 35),
        sort: (a, b) => order.indexOf(a) - order.indexOf(b),
        fit: false,
        animate: false,
      }).run();
      const s = node(m.start).position();
      cy.getElementById(START).position({ x: s.x - 80, y: s.y });
      cy.fit(cy.elements(), 30);
    }

    // States reachable from start first (in BFS order), then the unreachable ones.
    function bfsOrder(m) {
      const seen = [m.start];
      for (let i = 0; i < seen.length; i++) {
        for (const a of m.symbols) {
          for (const t of m.delta[seen[i]][a]) if (!seen.includes(t)) seen.push(t);
        }
      }
      return [...seen, ...m.states.filter((s) => !seen.includes(s))];
    }

    const node = (state) => cy.getElementById(nodeIds.get(state));
    const edge = (from, to) => cy.getElementById(edgeIds.get(`${nodeIds.get(from)}>${nodeIds.get(to)}`));

    function clearRun() {
      cy.elements().removeClass(RUN_CLASSES);
    }

    // Shows step k of a simulate() trace: everything up to k is the faded trail,
    // step k's edges and states are highlighted. When `finished`, the final states
    // turn green/red (for a dead run, the states it got stuck in).
    function showStep(m, steps, k, finished) {
      clearRun();
      for (let i = 0; i <= k; i++) {
        for (const s of steps[i].active) node(s).addClass("visited");
        for (const [from, , to] of steps[i].edges) edge(from, to).addClass("visited");
      }
      const current = steps[k];
      if (k === 0) cy.getElementById("start-edge").addClass("taken");
      for (const [from, , to] of current.edges) edge(from, to).addClass("taken");

      for (const s of current.active) pulse(node(s).addClass("active"));
      if (finished) {
        const ends = current.active.length ? current.active : steps[k - 1].active;
        for (const s of ends) {
          node(s).addClass(current.active.length && m.accepting.includes(s) ? "final-accept" : "final-reject");
        }
      }
    }

    function pulse(n) {
      n.stop(true, true)
        .animate({ style: { width: 58, height: 58 } }, { duration: 150 })
        .animate({ style: { width: 46, height: 46 } }, { duration: 200 });
    }

    return { draw, clearRun, showStep };
  }

  return { create };
})();
