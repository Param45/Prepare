const N = 50, MARKS = 2;
const KEY = "cogquiz.active", HIST = "cogquiz.history", LAST = "cogquiz.last";
const byId = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
const LETTERS = "ABCD";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const pad = (n) => String(n).padStart(2, "0");
const clock = (ms) => {
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};
const dur = (ms) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
};
const weekLabel = (q) => (q.week === 4 ? "Week 4 / 10" : `Week ${q.week}`);

// Storage can be blocked (private mode); the test still works, it just won't survive a reload.
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const drop = (k) => { try { localStorage.removeItem(k); } catch {} };

function rand(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n; // modulo bias is ~1e-8 for n <= 110
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function show(id) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== id;
  window.scrollTo(0, 0);
}

/* ---------- Home ---------- */

function renderHome() {
  $("#bank-size").textContent = QUESTIONS.length;
  const active = load(KEY, null);
  $("#resume").hidden = !active;
  if (active) {
    const done = active.answers.filter((a) => a !== null).length;
    $("#resume-info").textContent = `${done} of ${N} answered · ${clock(sum(active.times))} spent`;
  }
  $("#btn-start").textContent = active ? "Discard and start new" : "Start a new test";
  $("#btn-start").classList.toggle("ghost", !!active);
  $("#btn-last").hidden = !load(LAST, null);

  const hist = load(HIST, []);
  $("#history").hidden = !hist.length;
  $("#history ul").innerHTML = hist
    .map((h) => `<li><span><b>${h.score}</b><span class="muted">/100</span></span>
      <span class="muted small">${new Date(h.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${clock(h.timeMs)}</span></li>`)
    .join("");
  show("home");
}

/* ---------- Test ---------- */

let t = null, tick = 0, paused = false, timerId = 0;

function newTest() {
  if (load(KEY, null) && !confirm("Discard the test in progress?")) return;
  const ids = shuffle(QUESTIONS.map((q) => q.id)).slice(0, N);
  t = {
    items: ids.map((id) => ({ id, order: [0, 1, 2, 3] })), // options stay in PDF order
    answers: Array(N).fill(null), // original option index
    marked: Array(N).fill(false),
    times: Array(N).fill(0),
    cur: 0,
  };
  save(KEY, t);
  startTest();
}

function startTest() {
  tick = Date.now();
  paused = document.hidden;
  clearInterval(timerId);
  timerId = setInterval(commit, 1000);
  show("test");
  renderQ();
}

// Adds time since the last tick to the question on screen and autosaves.
function commit() {
  if (!t || paused) return;
  const now = Date.now();
  t.times[t.cur] += now - tick;
  tick = now;
  save(KEY, t);
  $("#timer").textContent = clock(sum(t.times));
}

document.addEventListener("visibilitychange", () => {
  if (!t) return;
  if (document.hidden) { commit(); paused = true; }
  else { paused = false; tick = Date.now(); }
});

function go(i) {
  if (i < 0 || i >= N) return;
  commit();
  t.cur = i;
  save(KEY, t);
  renderQ();
  window.scrollTo(0, 0);
}

function renderQ() {
  const item = t.items[t.cur], q = byId[item.id];
  const answered = t.answers.filter((a) => a !== null).length;
  $("#counter").textContent = `Q ${t.cur + 1} / ${N}`;
  $("#timer").textContent = clock(sum(t.times));
  $("#progress-fill").style.width = `${(answered / N) * 100}%`;
  $("#qtext").textContent = q.q;
  $("#options").innerHTML = item.order
    .map((o, pos) => `<button class="opt" role="radio" data-o="${o}" aria-checked="${t.answers[t.cur] === o}">
      <span class="letter">${LETTERS[pos]}</span><span class="txt">${esc(q.options[o])}</span></button>`)
    .join("");
  $("#btn-clear").hidden = t.answers[t.cur] === null;
  $("#btn-mark").setAttribute("aria-pressed", t.marked[t.cur]);
  $("#btn-mark").textContent = t.marked[t.cur] ? "Marked" : "Mark";
  $("#btn-prev").disabled = t.cur === 0;
  $("#btn-next").textContent = t.cur === N - 1 ? "Finish" : "Next";
}

function choose(o) {
  t.answers[t.cur] = o;
  save(KEY, t);
  renderQ();
}

function openPalette() {
  $("#grid").innerHTML = t.items
    .map((_, i) => {
      const cls = [t.marked[i] ? "marked" : t.answers[i] !== null ? "answered" : "", i === t.cur ? "current" : ""].join(" ");
      return `<button class="${cls}" data-i="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`;
    })
    .join("");
  $("#palette").showModal();
}

function openConfirm() {
  const answered = t.answers.filter((a) => a !== null).length, marked = t.marked.filter(Boolean).length;
  $("#confirm-counts").innerHTML = `<div><b>${answered}</b><span>answered</span></div>
    <div><b>${N - answered}</b><span>not answered</span></div><div><b>${marked}</b><span>marked</span></div>`;
  $("#confirm-note").textContent = N - answered
    ? `${N - answered} unanswered question${N - answered > 1 ? "s" : ""} will get 0 marks. You can't change answers after submitting.`
    : "You can't change answers after submitting.";
  $("#confirm").showModal();
}

function finish() {
  commit();
  clearInterval(timerId);
  const res = { date: Date.now(), items: t.items, answers: t.answers, marked: t.marked, times: t.times };
  const correct = res.items.filter((it, i) => res.answers[i] === byId[it.id].answer).length;
  save(LAST, res);
  save(HIST, [{ date: res.date, score: correct * MARKS, timeMs: sum(res.times) }, ...load(HIST, [])].slice(0, 10));
  drop(KEY);
  t = null;
  renderResults(res);
}

/* ---------- Results ---------- */

let rows = [];

function renderResults(r) {
  rows = r.items.map((it, i) => {
    const q = byId[it.id], ans = r.answers[i];
    const status = ans === null ? "skip" : ans === q.answer ? "ok" : "bad";
    return { i, q, order: it.order, ans, status, marked: r.marked[i], time: r.times[i] };
  });
  const count = (s) => rows.filter((x) => x.status === s).length;
  const ok = count("ok"), bad = count("bad"), skip = count("skip");
  const total = sum(r.times), score = ok * MARKS;

  $("#score").textContent = score;
  $("#cheer").textContent =
    score >= 80 ? "Excellent! You really know this material." :
    score >= 60 ? "Good going! A little more revision and you're there." :
    score >= 40 ? "Solid start. Review the misses below and go again." :
    "Every attempt helps. Go through the explanations below and try again.";

  $("#stats").innerHTML = [
    ["ok", ok, "correct"], ["bad", bad, "incorrect"], ["", skip, "not answered"],
    ["", ok + bad ? `${Math.round((ok / (ok + bad)) * 100)}%` : "–", "accuracy"],
    ["", clock(total), "total time"], ["", dur(total / N), "avg / question"],
  ].map(([c, v, l]) => `<div class="stat ${c}"><b>${v}</b><span>${l}</span></div>`).join("");

  // Week breakdown; unanswered counts as not correct.
  const weeks = {};
  for (const x of rows) {
    const w = (weeks[x.q.week] ||= { week: x.q.week, asked: 0, ok: 0, time: 0 });
    w.asked++; w.time += x.time; if (x.status === "ok") w.ok++;
  }
  const list = Object.values(weeks).sort((a, b) => a.week - b.week);
  $("#weeks").innerHTML = list.map((w) => {
    const pct = (w.ok / w.asked) * 100, cls = pct >= 70 ? "hi" : pct >= 40 ? "mid" : "lo";
    return `<div class="week"><span>${w.week === 4 ? "Week 4/10" : `Week ${w.week}`}</span>
      <span class="bar"><i class="${cls}" style="width:${Math.max(pct, 2)}%"></i></span>
      <span class="num">${w.ok}/${w.asked}</span></div>`;
  }).join("");

  // Focus: lowest accuracy among weeks with at least 2 questions; slower week wins a tie.
  const weak = list
    .filter((w) => w.asked >= 2 && w.ok < w.asked)
    .sort((a, b) => a.ok / a.asked - b.ok / b.asked || b.time / b.asked - a.time / a.asked)
    .slice(0, 2);
  const focus = $("#focus");
  focus.classList.toggle("warn", weak.length > 0);
  focus.innerHTML = weak.length
    ? `<h3>Focus on ${weak.map((w) => (w.week === 4 ? "Week 4/10" : `Week ${w.week}`)).join(" and ")}</h3>
       <p class="small">${weak.map((w) => `${weekLabel(w)}: ${w.ok}/${w.asked} correct, ${dur(w.time / w.asked)} per question`).join(" · ")}</p>`
    : `<h3>No weak weeks this time</h3><p class="small">Every week you were asked about came out clean. Nice.</p>`;

  $("#slow").innerHTML = [...rows].sort((a, b) => b.time - a.time).slice(0, 10).map((x) => `<li><details>
      <summary><span class="t">${dur(x.time)}</span><span class="q">${esc(x.q.q)}</span>${tag(x)}</summary>
      <div class="detail"><p class="muted">Q${x.i + 1} · ${weekLabel(x.q)}</p><p class="full">${esc(x.q.q)}</p>
        <p>Your answer: ${x.ans === null ? "<i>not answered</i>" : esc(x.q.options[x.ans])}</p>
        ${x.status === "ok" ? "" : `<p>Correct: <b>${esc(x.q.options[x.q.answer])}</b></p>`}</div>
    </details></li>`).join("");

  const filters = [["all", "All", rows.length], ["bad", "Incorrect", bad], ["skip", "Not answered", skip], ["marked", "Marked", rows.filter((x) => x.marked).length], ["ok", "Correct", ok]];
  $("#filters").innerHTML = filters
    .map(([k, l, n]) => `<button class="chip" role="tab" data-f="${k}" aria-selected="${k === "all"}">${l} · ${n}</button>`)
    .join("");
  renderReview("all");
  show("results");
}

function tag(x) {
  return x.status === "ok" ? `<span class="tag ok">Correct</span>` : x.status === "bad" ? `<span class="tag bad">Wrong</span>` : `<span class="tag">Skipped</span>`;
}

function renderReview(f) {
  const shown = rows.filter((x) => f === "all" || (f === "marked" ? x.marked : x.status === f));
  $("#review").innerHTML = shown.length ? shown.map((x) => `<article class="card rcard">
      <div class="meta"><span class="n">Q${x.i + 1}</span>${tag(x)}${x.marked ? `<span class="tag mk">Marked</span>` : ""}
        <span class="tag">${weekLabel(x.q)}</span><span class="tag">${dur(x.time)}</span></div>
      <p class="qtext">${esc(x.q.q)}</p>
      ${x.order.map((o, pos) => {
        const cls = o === x.q.answer ? "ok" : o === x.ans ? "bad" : "";
        const note = o === x.q.answer ? (o === x.ans ? "Your answer ✓" : "Correct answer") : o === x.ans ? "Your answer" : "";
        return `<div class="ropt ${cls}"><span class="letter">${LETTERS[pos]}</span><span>${esc(x.q.options[o])}${note ? `<em>${note}</em>` : ""}</span></div>`;
      }).join("")}
      ${x.q.explanation || x.q.ref ? `<p class="expl">${esc(x.q.explanation)}${x.q.ref ? `<span class="ref">Ref: ${esc(x.q.ref)}</span>` : ""}</p>` : ""}
    </article>`).join("") : `<p class="muted">Nothing here.</p>`;
}

/* ---------- Theme ---------- */

const ICON = {
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
};
const systemDark = matchMedia("(prefers-color-scheme: dark)");
// No saved choice means "follow the system".
const isDark = () => (document.documentElement.dataset.theme || (systemDark.matches ? "dark" : "light")) === "dark";
function syncTheme() {
  const dark = isDark();
  $('meta[name="theme-color"]').content = dark ? "#0D1821" : "#F3F8FC";
  for (const b of document.querySelectorAll(".theme-toggle")) {
    b.innerHTML = dark ? ICON.sun : ICON.moon;
    b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
}
for (const b of document.querySelectorAll(".theme-toggle")) {
  b.onclick = () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("cogquiz.theme", next); } catch {} // plain string: the <head> script reads it raw
    syncTheme();
  };
}
systemDark.addEventListener("change", syncTheme);
syncTheme();

/* ---------- Events ---------- */

$("#btn-start").onclick = newTest;
$("#btn-again").onclick = newTest;
$("#btn-resume").onclick = () => { t = load(KEY, null); if (t) startTest(); };
$("#btn-last").onclick = () => renderResults(load(LAST, null));
$("#btn-home").onclick = renderHome;
$("#btn-prev").onclick = () => go(t.cur - 1);
$("#btn-next").onclick = () => (t.cur === N - 1 ? openConfirm() : go(t.cur + 1));
$("#btn-mark").onclick = () => { t.marked[t.cur] = !t.marked[t.cur]; save(KEY, t); renderQ(); };
$("#btn-clear").onclick = () => choose(null);
$("#btn-palette").onclick = openPalette;
$("#btn-palette-submit").onclick = () => { $("#palette").close(); openConfirm(); };
$("#btn-submit").onclick = () => { $("#confirm").close(); finish(); };
$("#options").onclick = (e) => { const b = e.target.closest(".opt"); if (b) choose(+b.dataset.o); };
$("#grid").onclick = (e) => { const b = e.target.closest("button"); if (b) { $("#palette").close(); go(+b.dataset.i); } };
$("#filters").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  for (const c of $("#filters").children) c.setAttribute("aria-selected", c === b);
  renderReview(b.dataset.f);
};
for (const d of document.querySelectorAll("dialog")) {
  d.addEventListener("click", (e) => {
    const r = d.getBoundingClientRect(); // a click on the backdrop lands outside the dialog box
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if ((e.target === d && outside) || e.target.closest("[data-close]")) d.close();
  });
}
// Desktop shortcuts: A–D / 1–4 pick, arrows move.
document.addEventListener("keydown", (e) => {
  if (!t || $("#test").hidden || document.querySelector("dialog[open]") || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase(), pos = "abcd".indexOf(k) >= 0 ? "abcd".indexOf(k) : "1234".indexOf(k);
  if (pos >= 0) choose(t.items[t.cur].order[pos]);
  else if (e.key === "ArrowRight") go(t.cur + 1);
  else if (e.key === "ArrowLeft") go(t.cur - 1);
});

renderHome();
