// booking-widget.js — NoirTech
// Renders the booking flow into #calEmbed on index.html

(function () {
  "use strict";

  var EDGE_URL = "https://lzxiwmhvvnvalgglczit.supabase.co/functions/v1";

  var container = document.getElementById("calEmbed");
  var fallback  = document.getElementById("bookFallback");
  if (!container) return;
  if (fallback) fallback.style.display = "none";

  var SERVICES = [
    { label: "Discovery Call",        mins: 15, desc: "A quick intro to see if we are a fit." },
    { label: "Project Discussion",    mins: 30, desc: "Walk through scope, timeline and budget." },
    { label: "Technical Consultation",mins: 30, desc: "Deep dive on architecture or an existing build." }
  ];

  var STEPS = ["Service", "Date", "Time", "Details"];

  var state = {
    step: 1, service: null, date: null, slot: null,
    month: new Date(), cache: {}, email: null, loading: false,
    openDays: null,      // Set of day_of_week values that have active hours
    blocked: null        // Set of "YYYY-MM-DD" strings
  };

  /* ══════════════ STYLES ══════════════ */
  var css = document.createElement("style");
  css.textContent = [
    ".bw{font-family:inherit;color:var(--fg2);width:100%}",

    /* progress rail */
    ".bw-rail{display:flex;align-items:center;gap:0;padding:22px 24px;border-bottom:1px solid var(--line);flex-wrap:wrap}",
    ".bw-node{display:flex;align-items:center;gap:9px;flex-shrink:0}",
    ".bw-num{width:23px;height:23px;border-radius:50%;border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;font-family:var(--mono,monospace);font-size:10px;color:var(--fg3);flex-shrink:0;transition:all .3s var(--ease,ease)}",
    ".bw-node.done .bw-num{background:var(--fg);border-color:var(--fg);color:var(--bg)}",
    ".bw-node.now .bw-num{border-color:var(--fg);color:var(--fg)}",
    ".bw-lbl{font-size:12.5px;color:var(--fg3);white-space:nowrap;transition:color .3s}",
    ".bw-node.now .bw-lbl,.bw-node.done .bw-lbl{color:var(--fg)}",
    ".bw-bar{flex:1;height:1px;background:var(--line2);margin:0 12px;min-width:14px}",
    ".bw-bar.done{background:var(--fg3)}",

    /* body */
    ".bw-body{padding:clamp(22px,4vw,34px) clamp(20px,4vw,30px)}",
    ".bw-q{font-size:clamp(18px,2.4vw,22px);font-weight:600;color:var(--fg);letter-spacing:-.03em;margin:0 0 6px;line-height:1.25}",
    ".bw-sub{font-size:14px;color:var(--fg3);margin:0 0 24px;line-height:1.6}",

    /* service cards */
    ".bw-svcs{display:flex;flex-direction:column;gap:9px}",
    ".bw-svc{display:flex;align-items:center;gap:16px;padding:18px 20px;border:1px solid var(--line2);border-radius:12px;background:var(--bg2);cursor:pointer;transition:border-color .2s,background .2s,transform .25s var(--ease,ease);text-align:left;width:100%;font-family:inherit}",
    ".bw-svc:hover{border-color:var(--fg3);background:var(--bg3);transform:translateX(3px)}",
    ".bw-svc.sel{border-color:var(--fg);background:var(--bg3)}",
    ".bw-svc-main{flex:1;min-width:0}",
    ".bw-svc-t{display:block;font-size:15.5px;font-weight:600;color:var(--fg);letter-spacing:-.02em;margin-bottom:3px}",
    ".bw-svc-d{display:block;font-size:13px;color:var(--fg3);line-height:1.5}",
    ".bw-svc-meta{flex-shrink:0;text-align:right}",
    ".bw-svc-min{display:block;font-family:var(--mono,monospace);font-size:11px;color:var(--fg3);letter-spacing:.06em}",
    ".bw-arr{flex-shrink:0;color:var(--fg3);transition:transform .25s var(--ease,ease),color .2s}",
    ".bw-svc:hover .bw-arr{transform:translateX(3px);color:var(--fg)}",

    /* calendar */
    ".bw-cal-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;max-width:340px}",
    ".bw-mo{font-size:15.5px;font-weight:600;color:var(--fg);letter-spacing:-.02em}",
    ".bw-navs{display:flex;gap:6px}",
    ".bw-nav{width:32px;height:32px;border-radius:8px;border:1px solid var(--line2);background:transparent;color:var(--fg3);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color .2s,color .2s}",
    ".bw-nav:hover:not(:disabled){border-color:var(--fg3);color:var(--fg)}",
    ".bw-nav:disabled{opacity:.3;cursor:not-allowed}",
    ".bw-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;max-width:340px}",
    ".bw-dow{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg3);text-align:center;padding:0 0 8px}",
    ".bw-day{aspect-ratio:1;min-height:0;height:34px;border-radius:8px;font-size:13.5px;border:1px solid transparent;background:transparent;color:var(--fg);font-size:14px;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .18s,border-color .18s;position:relative}",
    ".bw-day:hover:not(:disabled){background:var(--bg3);border-color:var(--line2)}",
    ".bw-day:disabled{color:var(--fg3);opacity:.25;cursor:not-allowed}",
    ".bw-day.closed{position:relative;opacity:.3}",
    ".bw-day.closed::before{content:'';position:absolute;left:22%;right:22%;top:50%;height:1px;background:currentColor;opacity:.55}",
    ".bw-day.today::after{content:'';position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:var(--fg3)}",
    ".bw-day.sel{background:var(--fg);color:var(--bg);border-color:var(--fg);font-weight:600}",
    ".bw-day.sel.today::after{background:var(--bg)}",
    ".bw-empty{height:34px}",

    /* time slots */
    ".bw-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-bottom:20px;max-width:420px}",
    ".bw-period{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg3);margin:0 0 10px}",
    ".bw-slot{padding:12px 8px;border:1px solid var(--line2);border-radius:9px;background:var(--bg2);color:var(--fg);font-size:14px;font-family:inherit;cursor:pointer;transition:border-color .2s,background .2s;text-align:center}",
    ".bw-slot:hover{border-color:var(--fg3);background:var(--bg3)}",
    ".bw-slot.sel{border-color:var(--fg);background:var(--fg);color:var(--bg);font-weight:600}",

    /* summary strip */
    ".bw-recap{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:13px 16px;background:var(--bg2);border:1px solid var(--line);border-radius:10px;margin-bottom:22px}",
    ".bw-recap-i{font-size:13.5px;color:var(--fg2)}",
    ".bw-recap-i b{color:var(--fg);font-weight:600}",
    ".bw-recap-dot{width:3px;height:3px;border-radius:50%;background:var(--fg3);flex-shrink:0}",

    /* form */
    ".bw-f{display:flex;flex-direction:column;gap:15px}",
    ".bw-fl{display:flex;flex-direction:column;gap:7px}",
    ".bw-fl label{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg3)}",
    ".bw-in{font-family:inherit;font-size:16px;padding:13px 15px;border-radius:9px;background:var(--bg);color:var(--fg);border:1px solid var(--line2);outline:none;width:100%;box-sizing:border-box;transition:border-color .2s}",
    ".bw-in::placeholder{color:var(--fg3)}",
    ".bw-in:focus{border-color:var(--fg3)}",
    ".bw-in.err{border-color:#F87171}",
    "textarea.bw-in{resize:vertical;min-height:82px;line-height:1.6}",
    ".bw-cons{display:grid;grid-template-columns:18px 1fr;gap:11px;align-items:start;margin-top:2px}",
    ".bw-cb{appearance:none;-webkit-appearance:none;width:18px;height:18px;margin-top:2px;border:1px solid var(--line2);border-radius:5px;background:var(--bg);cursor:pointer;position:relative;flex-shrink:0;transition:background .2s,border-color .2s}",
    ".bw-cb:checked{background:var(--fg);border-color:var(--fg)}",
    ".bw-cb:checked::after{content:'';position:absolute;left:5.5px;top:2px;width:4px;height:9px;border:solid var(--bg);border-width:0 2px 2px 0;transform:rotate(42deg)}",
    ".bw-cons label{font-size:12.5px;line-height:1.6;color:var(--fg3);cursor:pointer}",

    /* actions */
    ".bw-acts{display:flex;gap:10px;align-items:center;margin-top:20px;flex-wrap:wrap}",
    ".bw-back{display:inline-flex;align-items:center;gap:7px;padding:12px 18px;border:1px solid var(--line2);border-radius:9px;background:transparent;color:var(--fg3);font-size:14px;font-family:inherit;cursor:pointer;transition:border-color .2s,color .2s}",
    ".bw-back:hover{border-color:var(--fg3);color:var(--fg)}",
    ".bw-go{flex:1;min-width:150px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 24px;border:1px solid var(--fg);border-radius:9px;background:var(--fg);color:var(--bg);font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;transition:opacity .2s;letter-spacing:-.01em}",
    ".bw-go:hover:not(:disabled){opacity:.88}",
    ".bw-go:disabled{opacity:.4;cursor:not-allowed}",

    /* states */
    ".bw-note{padding:26px 20px;text-align:center;font-size:14px;color:var(--fg3);line-height:1.65}",
    ".bw-err{font-size:13.5px;color:#F87171;margin:4px 0 0;line-height:1.5}",
    ".bw-wa-note{margin:16px 0 0;font-size:13px;line-height:1.6;color:var(--fg3)}",
    ".bw-wa-link{color:var(--fg);text-decoration:underline;text-underline-offset:3px}",
    ".bw-wa-link:hover{opacity:.8}",
    ".bw-spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(128,128,128,.25);border-top-color:currentColor;border-radius:50%;animation:bwspin .65s linear infinite}",
    "@keyframes bwspin{to{transform:rotate(360deg)}}",
    ".bw-skel{height:44px;border-radius:9px;background:var(--bg3);animation:bwpulse 1.4s ease-in-out infinite}",
    "@keyframes bwpulse{0%,100%{opacity:.5}50%{opacity:.9}}",

    /* done */
    ".bw-done{text-align:center;padding:14px 0 6px}",
    ".bw-tick{width:54px;height:54px;border-radius:50%;background:var(--green-bg);border:1px solid var(--green-line);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;color:var(--green)}",
    ".bw-done h3{font-size:clamp(20px,2.6vw,25px);font-weight:600;color:var(--fg);letter-spacing:-.035em;margin:0 0 8px}",
    ".bw-done>p{font-size:14.5px;color:var(--fg3);margin:0 0 24px;line-height:1.65}",
    ".bw-card{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:22px;text-align:left;margin-bottom:20px}",
    ".bw-row{display:grid;grid-template-columns:88px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);align-items:baseline}",
    ".bw-row:last-child{border-bottom:0;padding-bottom:0}",
    ".bw-row:first-child{padding-top:0}",
    ".bw-k{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--fg3)}",
    ".bw-v{font-size:15px;color:var(--fg);font-weight:500}",

    "@media(max-width:560px){",
    "  .bw-rail{padding:16px 18px;gap:0}",
    "  .bw-lbl{display:none}",
    "  .bw-bar{margin:0 6px}",
    "  .bw-svc{padding:15px 16px;gap:12px}",
    "  .bw-slots{grid-template-columns:repeat(auto-fill,minmax(88px,1fr))}",
    "  .bw-row{grid-template-columns:1fr;gap:3px}",
    "  .bw-go{flex:1 1 100%}",
    "}"
  ].join("\n");
  document.head.appendChild(css);

  /* ══════════════ HELPERS ══════════════ */
  function el(t, c, txt) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function svc() {
    for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].label === state.service) return SERVICES[i];
    return SERVICES[1];
  }
  function fmtTime(t) {
    var p = t.split(":"), h = parseInt(p[0], 10);
    return (h % 12 || 12) + ":" + p[1] + " " + (h >= 12 ? "pm" : "am");
  }
  function fmtDate(ds, long) {
    if (!ds) return "";
    return new Date(ds + "T00:00:00").toLocaleDateString("en-MY", long
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { weekday: "short", day: "numeric", month: "short" });
  }
  function icon(path, size) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", size || 15);
    s.setAttribute("height", size || 15);
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path);
    s.appendChild(p);
    return s;
  }

  /* ══════════════ RENDER ══════════════ */
  function render() {
    container.innerHTML = "";
    var wrap = el("div", "bw");

    if (state.step <= 4) wrap.appendChild(rail());

    var body = el("div", "bw-body");
    if (state.step === 1) stepService(body);
    else if (state.step === 2) stepDate(body);
    else if (state.step === 3) stepTime(body);
    else if (state.step === 4) stepDetails(body);
    else stepDone(body);
    wrap.appendChild(body);

    container.appendChild(wrap);
  }

  function rail() {
    var r = el("div", "bw-rail");
    STEPS.forEach(function (label, i) {
      var n = i + 1;
      var node = el("div", "bw-node" + (n < state.step ? " done" : n === state.step ? " now" : ""));
      var num = el("div", "bw-num");
      if (n < state.step) num.appendChild(icon("M20 6 9 17l-5-5", 11));
      else num.textContent = n;
      node.appendChild(num);
      node.appendChild(el("span", "bw-lbl", label));
      r.appendChild(node);
      if (i < STEPS.length - 1) r.appendChild(el("div", "bw-bar" + (n < state.step ? " done" : "")));
    });
    return r;
  }

  /* ---- Step 1: service ---- */
  function stepService(b) {
    b.appendChild(el("h3", "bw-q", "What would you like to talk about?"));
    b.appendChild(el("p", "bw-sub", "Pick the option that fits. All calls are no-obligation."));

    var list = el("div", "bw-svcs");
    SERVICES.forEach(function (s) {
      var card = el("button", "bw-svc" + (state.service === s.label ? " sel" : ""));
      card.type = "button";

      var main = el("div", "bw-svc-main");
      main.appendChild(el("span", "bw-svc-t", s.label));
      main.appendChild(el("span", "bw-svc-d", s.desc));
      card.appendChild(main);

      var meta = el("div", "bw-svc-meta");
      meta.appendChild(el("span", "bw-svc-min", s.mins + " min"));
      card.appendChild(meta);

      var arr = el("span", "bw-arr");
      arr.appendChild(icon("M5 12h14M12 5l7 7-7 7", 16));
      card.appendChild(arr);

      card.addEventListener("click", function () {
        state.service = s.label;
        state.date = null; state.slot = null; state.cache = {};
        state.step = 2;
        render();
      });
      list.appendChild(card);
    });
    b.appendChild(list);
  }

  /* ---- Step 2: date ---- */
  function stepDate(b) {
    b.appendChild(el("h3", "bw-q", "Pick a day"));
    b.appendChild(el("p", "bw-sub", "Greyed-out days are closed. Select any available date."));

    if (state.openDays === null) {
      var load = el("div", "bw-grid");
      for (var z = 0; z < 28; z++) {
        var sk = el("div", "bw-skel");
        sk.style.height = "34px";
        load.appendChild(sk);
      }
      b.appendChild(load);
      b.appendChild(actions(1));
      loadAvailability(function () { render(); });
      return;
    }

    var y = state.month.getFullYear(), m = state.month.getMonth();
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    var top = el("div", "bw-cal-top");
    top.appendChild(el("div", "bw-mo", state.month.toLocaleString("en-MY", { month: "long", year: "numeric" })));
    var navs = el("div", "bw-navs");

    var prev = el("button", "bw-nav"); prev.type = "button";
    prev.appendChild(icon("M15 18l-6-6 6-6", 15));
    prev.disabled = new Date(y, m, 1) <= thisMonth;
    prev.addEventListener("click", function () { state.month = new Date(y, m - 1, 1); render(); });

    var next = el("button", "bw-nav"); next.type = "button";
    next.appendChild(icon("M9 18l6-6-6-6", 15));
    next.addEventListener("click", function () { state.month = new Date(y, m + 1, 1); render(); });

    navs.appendChild(prev); navs.appendChild(next);
    top.appendChild(navs);
    b.appendChild(top);

    var g = el("div", "bw-grid");
    ["S", "M", "T", "W", "T", "F", "S"].forEach(function (d) { g.appendChild(el("div", "bw-dow", d)); });

    var first = new Date(y, m, 1).getDay();
    for (var i = 0; i < first; i++) g.appendChild(el("div", "bw-empty"));

    var total = new Date(y, m + 1, 0).getDate();
    for (var d = 1; d <= total; d++) {
      var dt = new Date(y, m, d);
      var ds = y + "-" + pad(m + 1) + "-" + pad(d);
      var past   = dt < today;
      var closed = dayClosed(dt, ds);
      var off    = past || closed;
      var cls = "bw-day" +
        (dt.getTime() === today.getTime() ? " today" : "") +
        (state.date === ds ? " sel" : "") +
        (closed && !past ? " closed" : "");
      var cell = el("button", cls, String(d));
      cell.type = "button";
      cell.disabled = off;
      if (closed && !past) cell.title = "Closed";
      if (!off) {
        (function (dstr) {
          cell.addEventListener("click", function () {
            state.date = dstr; state.slot = null; state.step = 3;
            render();
            if (!state.cache[dstr]) loadSlots(dstr);
          });
        })(ds);
      }
      g.appendChild(cell);
    }
    b.appendChild(g);
    b.appendChild(actions(1));
  }

  /* ---- Step 3: time ---- */
  function stepTime(b) {
    b.appendChild(el("h3", "bw-q", "Choose a time"));
    b.appendChild(el("p", "bw-sub", fmtDate(state.date, true) + " \u00b7 Malaysia time (GMT+8)"));

    var slots = state.cache[state.date];

    if (!slots) {
      var sk = el("div", "bw-slots");
      for (var i = 0; i < 8; i++) sk.appendChild(el("div", "bw-skel"));
      b.appendChild(sk);
      b.appendChild(actions(2));
      return;
    }

    if (!slots.length) {
      b.appendChild(el("p", "bw-note", "No times available on this day. Try another date \u2014 or WhatsApp us and we\u2019ll find a slot."));
      b.appendChild(actions(2));
      return;
    }

    // Group into morning / afternoon / night
    var groups = [
      { key: "morning",   label: "Morning" },
      { key: "afternoon", label: "Afternoon" },
      { key: "night",     label: "Evening" }
    ];

    groups.forEach(function (grp) {
      var inGroup = slots.filter(function (s) {
        if (s.period) return s.period === grp.key;
        return (parseInt(s.startTime.split(":")[0], 10) < 12) === (grp.key === "morning");
      });
      if (!inGroup.length) return;

      b.appendChild(el("p", "bw-period", grp.label));

      var g = el("div", "bw-slots");
      inGroup.forEach(function (s) {
        var sel = state.slot && state.slot.startTime === s.startTime;
        var btn = el("button", "bw-slot" + (sel ? " sel" : ""), fmtTime(s.startTime));
        btn.type = "button";
        btn.addEventListener("click", function () {
          state.slot = s; state.step = 4; render();
        });
        g.appendChild(btn);
      });
      b.appendChild(g);
    });

    /* "Contact us" note for off-schedule times */
    var waNote = el("p","bw-wa-note");
    waNote.innerHTML = "Need a different time? <a href=\"https://wa.me/60174565764?text=" +
      encodeURIComponent("Hello NoirTech, I would like to schedule a call at a time not listed on your booking page.") +
      "\" target=\"_blank\" rel=\"noopener\" class=\"bw-wa-link\">Chat with us on WhatsApp</a>.";
    b.appendChild(waNote);

    b.appendChild(actions(2));
  }

  /* ---- Step 4: details ---- */
  function stepDetails(b) {
    b.appendChild(el("h3", "bw-q", "Almost done"));
    b.appendChild(el("p", "bw-sub", "Just your name and email so we know who we\u2019re meeting."));

    var recap = el("div", "bw-recap");
    function chip(html) {
      var i = el("div", "bw-recap-i"); i.innerHTML = html; return i;
    }
    recap.appendChild(chip("<b>" + state.service + "</b>"));
    recap.appendChild(el("div", "bw-recap-dot"));
    recap.appendChild(chip(fmtDate(state.date)));
    recap.appendChild(el("div", "bw-recap-dot"));
    recap.appendChild(chip("<b>" + fmtTime(state.slot.startTime) + "</b>"));
    b.appendChild(recap);

    var f = el("div", "bw-f");

    function field(labelText, type, ph, isArea) {
      var w = el("div", "bw-fl");
      var l = el("label", null, labelText);
      var inp = isArea ? el("textarea", "bw-in") : el("input", "bw-in");
      if (!isArea) inp.type = type;
      inp.placeholder = ph;
      if (isArea) inp.rows = 3;
      var id = "bwf" + Math.random().toString(36).slice(2, 7);
      inp.id = id; l.htmlFor = id;
      w.appendChild(l); w.appendChild(inp);
      return w;
    }

    var fName  = field("Your name", "text", "");
    var fMail  = field("Email address", "email", "");
    var fNote  = field("Anything to cover? (optional)", "text", "", true);

    var cons = el("div", "bw-cons");
    var cb = el("input", "bw-cb"); cb.type = "checkbox"; cb.id = "bwcons";
    var cl = el("label", null, "I consent to NoirTech using these details to arrange this call, in line with the Personal Data Protection Act 2010.");
    cl.htmlFor = "bwcons";
    cons.appendChild(cb); cons.appendChild(cl);

    var err = el("p", "bw-err"); err.style.display = "none";

    f.appendChild(fName); f.appendChild(fMail); f.appendChild(fNote);
    f.appendChild(cons); f.appendChild(err);

    var acts = el("div", "bw-acts");
    var back = el("button", "bw-back"); back.type = "button";
    back.appendChild(icon("M19 12H5M12 19l-7-7 7-7", 14));
    back.appendChild(document.createTextNode("Back"));
    back.addEventListener("click", function () { state.step = 3; render(); });

    var go = el("button", "bw-go", "Confirm booking");
    go.type = "button";
    go.disabled = true;
    cb.addEventListener("change", function () { go.disabled = !cb.checked; });

    go.addEventListener("click", function () {
      var nameEl = fName.querySelector("input");
      var mailEl = fMail.querySelector("input");
      var noteEl = fNote.querySelector("textarea");
      var name = nameEl.value.trim(), mail = mailEl.value.trim();

      nameEl.classList.remove("err"); mailEl.classList.remove("err");

      if (!name) { fail(err, nameEl, "Please enter your name."); return; }
      if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        fail(err, mailEl, "Please enter a valid email address."); return;
      }

      err.style.display = "none";
      go.disabled = true;
      go.innerHTML = "";
      go.appendChild(el("span", "bw-spin"));
      go.appendChild(document.createTextNode(" Booking\u2026"));

      fetch(EDGE_URL + "/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: name,
          clientEmail: mail,
          serviceType: state.service,
          bookingDate: state.date,
          startTime: state.slot.startTime,
          endTime: state.slot.endTime,
          slotId: state.slot._parentSlotId || state.slot.slotId,
          notes: noteEl.value.trim() || null,
          consentGiven: true
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.success) {
            state.email = mail;
            state.step = 5;
            render();
            container.scrollIntoView({ behavior: "smooth", block: "center" });
          } else {
            var msg = (d && d.error) || "Something went wrong. Please try again.";
            // If the slot was just taken, clear cache so the calendar refreshes
            if (msg.indexOf("just been taken") !== -1 || msg.indexOf("409") !== -1) {
              delete state.cache[state.date];
              state.slot = null;
              fail(err, null, "That slot was just taken. Please go back and choose another time.");
            } else {
              fail(err, null, msg);
            }
            reset();
          }
        })
        .catch(function () {
          fail(err, null, "Network problem. Please try again or WhatsApp us.");
          reset();
        });

      function reset() {
        go.disabled = false;
        go.textContent = "Confirm booking";
      }
    });

    acts.appendChild(back); acts.appendChild(go);
    f.appendChild(acts);
    b.appendChild(f);
  }

  function fail(errEl, inputEl, msg) {
    errEl.textContent = msg;
    errEl.style.display = "block";
    if (inputEl) { inputEl.classList.add("err"); inputEl.focus(); }
  }

  /* ---- Step 5: done ---- */
  function stepDone(b) {
    var d = el("div", "bw-done");

    var tick = el("div", "bw-tick");
    tick.appendChild(icon("M20 6 9 17l-5-5", 24));
    d.appendChild(tick);

    d.appendChild(el("h3", null, "You\u2019re booked in."));
    d.appendChild(el("p", null, "A confirmation is on its way to " + (state.email || "your inbox") + "."));

    var card = el("div", "bw-card");
    function row(k, v) {
      var r = el("div", "bw-row");
      r.appendChild(el("div", "bw-k", k));
      r.appendChild(el("div", "bw-v", v));
      card.appendChild(r);
    }
    row("Service", state.service);
    row("Date", fmtDate(state.date, true));
    row("Time", fmtTime(state.slot.startTime) + " \u2013 " + fmtTime(state.slot.endTime) + " MYT");
    d.appendChild(card);

    d.appendChild(el("p", "bw-sub", "Need to change it? Use the cancel link in your confirmation email \u2014 no login required."));

    var again = el("button", "bw-back", "Book another call");
    again.type = "button";
    again.style.margin = "0 auto";
    again.addEventListener("click", function () {
      state = { step: 1, service: null, date: null, slot: null, month: new Date(), cache: {}, email: null };
      render();
    });
    d.appendChild(again);

    b.appendChild(d);
  }

  /* ---- shared back button row ---- */
  function actions(to) {
    var a = el("div", "bw-acts");
    var back = el("button", "bw-back"); back.type = "button";
    back.appendChild(icon("M19 12H5M12 19l-7-7 7-7", 14));
    back.appendChild(document.createTextNode("Back"));
    back.addEventListener("click", function () { state.step = to; render(); });
    a.appendChild(back);
    return a;
  }

  /* ---- data ---- */
  // Pull the weekly pattern + blocked dates once, so the calendar can grey out
  // days that are closed BEFORE the visitor clicks them.
  function loadAvailability(cb) {
    fetch(EDGE_URL + "/get-available-slots?meta=1")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.openDays = new Set(d.openDays || []);
        state.blocked  = new Set(d.blockedDates || []);
        if (cb) cb();
      })
      .catch(function () {
        // If the meta call fails, fall back to allowing all days.
        state.openDays = null;
        state.blocked  = new Set();
        if (cb) cb();
      });
  }

  function dayClosed(dateObj, ds) {
    if (state.blocked && state.blocked.has(ds)) return true;
    if (state.openDays && state.openDays.size) return !state.openDays.has(dateObj.getDay());
    return false;
  }

  function loadSlots(ds) {
    fetch(EDGE_URL + "/get-available-slots?date=" + ds)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        // Deduplicate by startTime as a safety net
        var seen = {};
        var slots = (d.slots || []).filter(function(s){
          if (seen[s.startTime]) return false;
          seen[s.startTime] = true;
          return true;
        });
        state.cache[ds] = slots;
        if (state.date === ds) render();
      })
      .catch(function () { state.cache[ds] = []; if (state.date === ds) render(); });
  }

  render();
})();
