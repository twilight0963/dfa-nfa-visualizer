// Run panel: input tape, step/play controls and the accept/reject verdict.
// Plays back an Automaton.simulate() trace on the graph one step at a time.

const Run = (() => {
  const fmt = (states) => `{${states.join(", ")}}`;

  function create() {
    const $ = (id) => document.getElementById(id);
    const input = $("input-str");
    const buttons = { back: $("back-btn"), step: $("step-btn"), play: $("play-btn"), reset: $("reset-btn") };
    const speed = $("speed");
    const errorList = $("run-errors");
    const tape = $("tape");
    const status = $("run-status");
    const verdict = $("verdict");

    let m = null;       // machine snapshot from the last Build
    let graph = null;
    let run = null;     // { steps, accepted, deadAt, input } once started
    let k = 0;          // step currently shown
    let timer = null;

    const last = () => run.steps.length - 1;
    const delay = () => 2600 - Number(speed.value); // slider right = faster

    function setMachine(machine, g) {
      m = machine;
      graph = g;
      for (const b of Object.values(buttons)) b.disabled = false;
      invalidate();
    }

    // Input or machine changed: drop the current run.
    function invalidate() {
      stop();
      run = null;
      k = 0;
      graph?.clearRun();
      showErrors([]);
      verdict.hidden = true;
      status.textContent = m ? "Press Step or Play to start." : "Build the machine first.";
      renderTape();
    }

    function showErrors(errors) {
      errorList.replaceChildren(...errors.map((e) => {
        const li = document.createElement("li");
        li.textContent = e;
        return li;
      }));
      errorList.hidden = errors.length === 0;
    }

    // Starts a run at step 0. Returns false if the input is not over the alphabet.
    function start() {
      const errors = Automaton.validate(m, input.value);
      showErrors(errors);
      if (errors.length) return false;
      run = { ...Automaton.simulate(m, input.value), input: input.value };
      k = 0;
      render();
      return true;
    }

    // ---- controls ----

    function step() {
      if (!m) return;
      if (!run) { start(); return; }
      if (k < last()) { k++; render(); }
      if (k === last()) stop();
    }

    function back() {
      stop();
      if (run && k > 0) { k--; render(); }
    }

    function reset() {
      stop();
      if (run) { k = 0; render(); }
    }

    function togglePlay() {
      if (!m) return;
      if (timer) { stop(); return; }
      if (!run && !start()) return;
      if (k === last()) { k = 0; render(); }
      buttons.play.textContent = "Pause";
      timer = setInterval(step, delay());
    }

    function stop() {
      clearInterval(timer);
      timer = null;
      buttons.play.textContent = "Play";
    }

    // ---- rendering ----

    function render() {
      const finished = k === last();
      graph.showStep(m, run.steps, k, finished);
      renderTape();
      renderStatus();
      renderVerdict(finished);
    }

    // Characters 0..k-1 are consumed; k-1 is the one just read.
    function renderTape() {
      const text = run ? run.input : input.value;
      if (!text) {
        tape.replaceChildren(Object.assign(document.createElement("span"),
          { className: "cell empty", textContent: "ε (empty string)" }));
        return;
      }
      const dead = run && k === last() && run.deadAt !== null;
      tape.replaceChildren(...[...text].map((c, i) => {
        let cls = "unread";
        if (run && i < k - 1) cls = "read";
        if (run && i === k - 1) cls = "current";
        if (dead && i > run.deadAt) cls = "skipped";
        return Object.assign(document.createElement("span"), { className: `cell ${cls}`, textContent: c });
      }));
    }

    function renderStatus() {
      const current = run.steps[k];
      status.textContent = k === 0
        ? `Start in ${fmt(current.active)}.`
        : `Step ${k} of ${run.input.length}: read '${current.symbol}' → ` +
          (current.active.length ? fmt(current.active) : "∅ (no states left)");
    }

    function renderVerdict(finished) {
      verdict.hidden = !finished;
      if (!finished) return;
      const end = run.steps[k];
      let reason;
      if (run.accepted) {
        reason = `ended in accepting state ${fmt(end.active.filter((s) => m.accepting.includes(s)))}`;
      } else if (run.deadAt !== null) {
        reason = `no transition on '${end.symbol}' from ${fmt(run.steps[k - 1].active)}`;
      } else {
        reason = `ended in ${fmt(end.active)}, which has no accepting state`;
      }
      verdict.className = `verdict ${run.accepted ? "accept" : "reject"}`;
      verdict.replaceChildren(
        Object.assign(document.createElement("strong"), { textContent: run.accepted ? "ACCEPT" : "REJECT" }),
        ` — ${reason}`);
    }

    // ---- wiring ----

    buttons.step.addEventListener("click", step);
    buttons.back.addEventListener("click", back);
    buttons.reset.addEventListener("click", reset);
    buttons.play.addEventListener("click", togglePlay);
    input.addEventListener("input", () => { if (m) invalidate(); else renderTape(); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") step(); });
    speed.addEventListener("input", () => {
      if (timer) { clearInterval(timer); timer = setInterval(step, delay()); }
    });

    for (const b of Object.values(buttons)) b.disabled = true;
    invalidate();
    return { setMachine };
  }

  return { create };
})();
