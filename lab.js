/* Shared engine for the tabbed lab pages (control.html, identify.html).
   A page calls MicroLab.page({title, chap, tabs, pics}) once its TABS are defined.
   Each tab: {tab, title, ex, question, how:[...], more:[[heading, picKey|null, [paragraphs]]], render(body), quiz:[q(...)]} */
window.MicroLab = (function(){
  const $ = id => document.getElementById(id);
  const f1 = n => Math.round(n * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = k => { const v = Math.sin(k * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;"})[c]);
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const q = (qq, opts, a, why) => ({q:qq, opts, a, why});
  const T = (x, y, t, o) => { o = o || {}; return `<text x="${f1(x)}" y="${f1(y)}" font-size="${o.fs || 14}" font-weight="${o.w || 700}" fill="${o.c || "#343b4a"}" text-anchor="${o.a || "middle"}"${o.it ? ` font-style="italic"` : ""}>${t}</text>`; };
  let cleanups = [];
  const onCleanup = fn => cleanups.push(fn);
  let uid = 0;
  const id = p => (p || "u") + (++uid);

  /* ---------- SVG building blocks ---------- */
  /* a Petri plate seen from above */
  function plateSVG(cx, cy, r, agar, inner, o){
    o = o || {};
    return `<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="#e3e7ee" stroke="#aab3c2" stroke-width="2"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${agar}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="2"` : ""}/>` + (inner || "") +
      (o.noshine ? "" : `<path d="M${f1(cx - r * .7)},${f1(cy - r * .55)} A${r * .85},${r * .85} 0 0 1 ${f1(cx - r * .05)},${f1(cy - r * .86)}" fill="none" stroke="#fff" stroke-width="3" opacity=".45"/>`);
  }
  /* pie sections: returns array of {a0,a1,mid:[x,y]} starting at 12 o'clock, clockwise */
  function pie(cx, cy, r, n){
    return Array.from({length:n}, (_, i) => {
      const a0 = -Math.PI / 2 + i * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n, am = (a0 + a1) / 2;
      return {a0, a1, mid:[cx + Math.cos(am) * r * .58, cy + Math.sin(am) * r * .58],
        path:`M${cx},${cy} L${f1(cx + Math.cos(a0) * r)},${f1(cy + Math.sin(a0) * r)} A${r},${r} 0 0 1 ${f1(cx + Math.cos(a1) * r)},${f1(cy + Math.sin(a1) * r)} Z`};
    });
  }
  /* growth inside a pie slice: score 0..4 */
  function sliceGrowth(cx, cy, r, s, score, seed, col){
    if (!score) return "";
    const n = [0, 6, 16, 34, 60][score], c = col || "#fbf3dc";
    let out = "";
    for (let k = 0; k < n; k++){
      const a = s.a0 + .12 + rnd(seed + k) * (s.a1 - s.a0 - .24), d = r * (.18 + rnd(seed + k + 50) * .72);
      out += `<circle cx="${f1(cx + Math.cos(a) * d)}" cy="${f1(cy + Math.sin(a) * d)}" r="${f1(score >= 3 ? 3.6 : 3)}" fill="${c}" stroke="#b8a067" stroke-width=".7"/>`;
    }
    if (score >= 3){
      const am = (s.a0 + s.a1) / 2;
      out = `<path d="M${f1(cx + Math.cos(am) * r * .2)},${f1(cy + Math.sin(am) * r * .2)} L${f1(cx + Math.cos(am) * r * .85)},${f1(cy + Math.sin(am) * r * .85)}" stroke="${c}" stroke-width="${score === 4 ? 14 : 9}" stroke-linecap="round" opacity=".85"/>` + out;
    }
    return out;
  }
  /* test tube (broth) */
  function tubeSVG(cx, top, w, h, fill, extra, cap){
    const l = cx - w / 2, r = cx + w / 2, rr = w / 2, b = top + h, k = id("tc");
    return `<clipPath id="${k}"><path d="M${l + 2},${top} L${l + 2},${b - rr} A${rr - 2},${rr - 2} 0 0 0 ${r - 2},${b - rr} L${r - 2},${top} Z"/></clipPath>` +
      `<g clip-path="url(#${k})"><rect x="${l}" y="${top + h * .22}" width="${w}" height="${h}" fill="${fill}"/>${extra || ""}</g>` +
      `<path d="M${l},${top} L${l},${b - rr} A${rr},${rr} 0 0 0 ${r},${b - rr} L${r},${top}" fill="none" stroke="#8b93a3" stroke-width="3"/>` +
      `<rect x="${l - 4}" y="${top - 12}" width="${w + 8}" height="14" rx="4" fill="${cap || "#8b93a3"}"/>`;
  }
  const scoreTxt = s => ["−", "+", "2+", "3+", "4+"][s];

  /* ---------- order game ---------- */
  function orderGame(host, steps, intro){
    let i, wrong, hints, pool;
    const start = () => {
      i = 0; wrong = 0; hints = 0;
      do { pool = shuffle(steps); } while (pool.length > 1 && pool.every((s, k) => s.id === steps[k].id));
      draw(intro || "Tap the steps in the order they happen. Wrong turns are counted.", "");
    };
    const draw = (msg, kind, shakeId) => {
      host.innerHTML = `<div class="ogame"><div class="benchhint ${kind || ""}" role="status">${msg}</div>
        <ol class="odone">${steps.slice(0, i).map((s, k) => `<li><b>${k + 1}.</b> ${s.text}${s.why ? `<small>${s.why}</small>` : ""}</li>`).join("")}</ol>
        ${i < steps.length ? `<div class="opool">${pool.filter(p => steps.findIndex(s => s.id === p.id) >= i).map(p => `<button data-id="${p.id}" class="${p.id === shakeId ? "shake" : ""}">${p.text}</button>`).join("")}</div>` : ""}
        <div class="row">${i < steps.length ? `<button class="btn hint" data-h="1">💡 Hint</button>` : ""}<button class="btn secondary" data-r="1">↺ Start over</button></div></div>`;
    };
    host.onclick = e => {
      if (e.target.closest("[data-r]")) { start(); return; }
      if (e.target.closest("[data-h]")) { hints++; draw("Hint: the next step is about <b>" + esc(steps[i].cue) + "</b>.", "warn"); return; }
      const b = e.target.closest("[data-id]"); if (!b) return;
      if (b.dataset.id === steps[i].id){ i++; if (i >= steps.length) draw(`All ${steps.length} steps in order! Wrong turns: <b>${wrong}</b>. Hints used: <b>${hints}</b>.`, "good"); else draw("Yes! What comes next?", "good"); }
      else { wrong++; draw("Not yet. Think about what has to happen first.", "warn", b.dataset.id); }
    };
    start();
  }

  /* ---------- picture quiz: items = [{svg, ask, opts:[...], a, why}] ---------- */
  function pictureGame(host, items, o){
    o = o || {};
    let order, idx, score, tries, answered;
    const start = () => { order = o.keepOrder ? items.slice() : shuffle(items); idx = 0; score = 0; tries = 0; show(); };
    const show = () => {
      answered = false;
      const cur = order[idx], ord = cur.opts.map((_, k) => k).sort((a, b) => rnd(idx * 5 + a + cur.opts.length) - rnd(idx * 5 + b + cur.opts.length));
      host.innerHTML = `<div class="grid2"><div class="panel pgpic" style="max-width:${o.picW || 340}px">${cur.svg}</div>
        <div><p class="qq" style="margin:0 0 6px">${cur.ask}</p><div class="ans" style="flex-direction:column;align-items:stretch">${ord.map(k => `<button data-k="${k}" style="text-align:left">${cur.opts[k]}</button>`).join("")}</div>
        <div class="benchhint" data-fb="1">Picture ${idx + 1} of ${order.length}. Score so far: ${score} of ${tries}.</div>
        <div class="row"><button class="btn primary pgNext" hidden>${idx + 1 >= order.length ? "Start this set again" : "Next picture"}</button></div></div></div>`;
    };
    host.onclick = e => {
      if (e.target.closest(".pgNext")){ if (idx + 1 >= order.length) start(); else { idx++; show(); } return; }
      const b = e.target.closest("[data-k]"); if (!b || answered) return;
      const cur = order[idx], ok = +b.dataset.k === cur.a, fb = host.querySelector("[data-fb]"); tries++;
      if (ok){ score++; answered = true; b.classList.add("right"); fb.className = "benchhint good"; fb.innerHTML = `<b>Yes!</b> ${cur.why} Score: ${score} of ${tries}.`; host.querySelectorAll(".ans button").forEach(x => x.disabled = true); host.querySelector(".pgNext").hidden = false; }
      else { b.classList.add("wrong"); b.disabled = true; fb.className = "benchhint warn"; fb.textContent = "Not quite. Look at the picture again and try another."; }
    };
    start();
  }

  /* ---------- main ideas: boxes side by side. cards = [[heading, text, tagline?]] ---------- */
  function ideas(title, cards, o){
    o = o || {};
    return (title ? `<div class="sect">${title}</div>` : "") + (o.lead ? `<p class="lead">${o.lead}</p>` : "") +
      `<div class="ideas">${cards.map(([h, p, tag], i) => `<div class="idea c${(i + (o.shift || 0)) % 6}"><h4>${h}</h4>${tag ? `<span class="tagline">${tag}</span>` : ""}<p>${p}</p></div>`).join("")}</div>`;
  }
  /* ---------- tap-to-learn picture: any element with data-x="key" shows INFO[key] = [title, text] ---------- */
  function explore(host, svg, INFO, intro){
    host.innerHTML = `<div class="panel tight" style="max-width:none">${typeof svg === "function" ? svg(host.clientWidth < 560) : svg}</div><div class="benchhint xinfo" role="status">${intro}</div>`;
    const info = host.querySelector(".xinfo");
    host.onclick = e => {
      const g = e.target.closest("[data-x]"); if (!g || !INFO[g.dataset.x]) return;
      host.querySelectorAll("[data-x].xsel").forEach(x => x.classList.remove("xsel"));
      g.classList.add("xsel");
      const [h, p] = INFO[g.dataset.x];
      info.className = "benchhint xinfo good"; info.innerHTML = `<b>${h}:</b> ${p}`;
    };
  }

  /* ---------- page shell ---------- */
  function page(cfg){
    const TABS = cfg.tabs, PICS = cfg.pics || {};
    let tabKey = Object.keys(TABS)[0];

    const m = document.createElement("div");
    m.className = "tmodal"; m.id = "tModal"; m.hidden = true;
    m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-labelledby", "tTitle");
    m.innerHTML = `<div class="tcard"></div>`;
    document.body.appendChild(m);

    function openTheory(){
      const t = TABS[tabKey];
      m.querySelector(".tcard").innerHTML = `<div class="thead"><div><div class="tkick">Understand the exercise</div><h2 id="tTitle">${t.title}</h2></div><button class="tclose" id="tClose" aria-label="Close">×</button></div>
        <div class="tasks"><span class="tlabel">The question it answers</span><p>${t.question}</p></div>
        <div class="tsec"><h3>Key ideas</h3><ul>${t.how.map(x => `<li>${x}</li>`).join("")}</ul></div>
        ${(t.more || []).map(([h, pic, ps]) => `<div class="tsec"><h3>${h}</h3>${pic && PICS[pic] ? `<div class="panel" style="margin-bottom:10px;max-width:none">${PICS[pic]()}</div>` : ""}${ps.map(x => `<p style="margin:0 0 8px;line-height:1.6">${x}</p>`).join("")}</div>`).join("")}
        <div class="tfoot"><button class="btn primary" id="tBack">Back to the bench</button></div>`;
      m.hidden = false; document.body.style.overflow = "hidden"; m.querySelector(".tcard").scrollTop = 0;
      const close = () => { m.hidden = true; document.body.style.overflow = ""; const b = $("theoryBtn"); if (b) b.focus({preventScroll:true}); };
      $("tClose").onclick = close; $("tBack").onclick = close;
      m.onclick = e => { if (e.target === m) close(); };
      m.onkeydown = e => { if (e.key === "Escape") close(); };
      $("tClose").focus();
    }

    function quizHTML(t){
      return `<section class="quiz"><div class="quizhead"><h3>Test yourself${t.quiz.length > 10 ? ` <span style="font-weight:400;font-size:.9rem;color:var(--muted)">(10 of ${t.quiz.length})</span>` : ""}</h3><div class="row" style="margin:0">${t.quiz.length > 10 ? `<button class="btn secondary sm" id="quizNew">🔀 New set of 10</button>` : ""}<button class="btn secondary sm" id="theoryBtn2">📖 Review the theory first</button></div></div>` + (t._cur = t.quiz.length > 10 ? shuffle(t.quiz).slice(0, 10) : t.quiz.slice()).map((qq, i) => {
        const order = qq.opts.map((_, k) => k).sort((a, b) => rnd(i * 7 + a + tabKey.length) - rnd(i * 7 + b + tabKey.length));
        return `<div class="qcard" data-q="${i}"><p class="qq">${i + 1}. ${qq.q}</p><div class="qopts">${order.map(k => `<button class="qopt" data-k="${k}">${qq.opts[k]}</button>`).join("")}</div><div class="qfb" hidden></div></div>`;
      }).join("") + `<p class="qscore" id="qScore"></p></section>`;
    }
    function bindQuiz(t){
      const box = $("quizBox"), got = {};
      const nb = $("quizNew"); if (nb) nb.onclick = () => { box.innerHTML = quizHTML(t); bindQuiz(t); const b2 = $("theoryBtn2"); if (b2) b2.onclick = openTheory; box.scrollIntoView({behavior:"smooth", block:"start"}); };
      box.querySelectorAll(".qcard").forEach(card => card.addEventListener("click", e => {
        const b = e.target.closest(".qopt"); if (!b || card.classList.contains("done")) return;
        const qq = t._cur[+card.dataset.q], ok = +b.dataset.k === qq.a, fb = card.querySelector(".qfb");
        if (ok){ card.classList.add("done"); b.classList.add("right"); fb.className = "qfb good"; fb.innerHTML = `<b>Yes!</b> ${qq.why}`; if (!(card.dataset.q in got)) got[card.dataset.q] = true; }
        else { b.classList.add("wrong"); b.disabled = true; fb.className = "qfb bad"; fb.innerHTML = "Not quite. Try another answer."; if (!(card.dataset.q in got)) got[card.dataset.q] = false; }
        fb.hidden = false;
        if (box.querySelectorAll(".qcard.done").length === t._cur.length) $("qScore").textContent = `Finished! ${Object.values(got).filter(Boolean).length} of ${t._cur.length} right on the first try.`;
      }));
    }

    function renderTab(){
      cleanups.forEach(fn => fn()); cleanups = [];
      const t = TABS[tabKey];
      $("app").innerHTML = `
        <header><div><a class="backlink" href="index.html">Lab review</a><h1>${cfg.title}<span class="chap">${cfg.chap}</span></h1></div></header>
        <div class="labtabs" id="labTabs">${Object.keys(TABS).map(k => `<button class="labtab ${k === tabKey ? "on" : ""}" data-tab="${k}">${TABS[k].tab}</button>`).join("")}</div>
        <div class="labwrap">
          <div class="labhead"><h2>${t.title} <span class="chap" style="background:#e7e9fb;color:#2c3796">${t.ex}</span></h2><button class="btn hint" id="theoryBtn">📖 Understand the exercise</button></div>
          <p class="labq"><b>Question:</b> ${t.question}</p>
          <div id="tabBody"></div>
          <div id="quizBox">${quizHTML(t)}</div>
        </div>`;
      $("labTabs").onclick = e => { const b = e.target.closest("[data-tab]"); if (!b) return; tabKey = b.dataset.tab; history.replaceState(null, "", "#" + tabKey); renderTab(); };
      t.render($("tabBody")); bindQuiz(t);
      $("theoryBtn").onclick = openTheory; $("theoryBtn2").onclick = openTheory;
    }
    const h = location.hash.slice(1); if (TABS[h]) tabKey = h;
    window.addEventListener("hashchange", () => { const k = location.hash.slice(1); if (TABS[k] && k !== tabKey){ tabKey = k; renderTab(); window.scrollTo({top:0, behavior:"smooth"}); } });
    renderTab();
  }

  return {$, f1, clamp, rnd, esc, shuffle, q, T, id, onCleanup, plateSVG, pie, sliceGrowth, tubeSVG, scoreTxt, orderGame, pictureGame, ideas, explore, page};
})();
