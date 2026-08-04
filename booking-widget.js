// booking-widget.js
// Renders a full booking UI into #calEmbed on index.html.
// Add at the bottom of index.html just before </body>:
//   <script src="booking-widget.js"></script>

(function () {
  "use strict";

  var EDGE_URL = "https://lzxiwmhvvnvalgglczit.supabase.co/functions/v1";

  var container = document.getElementById("calEmbed");
  var fallback  = document.getElementById("bookFallback");

  if (!container) return;

  // Hide the fallback panel — we're taking over
  if (fallback) fallback.style.display = "none";

  // ─── STATE ─────────────────────────────────────────────────
  var state = {
    step:         1,        // 1-5
    service:      null,
    date:         null,     // "YYYY-MM-DD"
    slot:         null,     // { slotId, startTime, endTime, _parentSlotId }
    currentMonth: new Date(),
    slotsCache:   {},       // date -> [slots]
    loading:      false,
  };

  var SERVICES = [
    { id: "discovery",     label: "Discovery Call",          duration: "15 min", price: "Free" },
    { id: "discussion",    label: "Project Discussion",       duration: "30 min", price: "Free" },
    { id: "consultation",  label: "Technical Consultation",   duration: "30 min", price: "" },
  ];

  // ─── STYLES ────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = [
    ".bw{padding:28px 0;font-family:inherit;color:var(--fg);width:100%}",
    ".bw-steps{display:flex;gap:6px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--line)}",
    ".bw-step-dot{width:7px;height:7px;border-radius:50%;background:var(--line2);transition:background .25s}",
    ".bw-step-dot.on{background:var(--fg)}",
    ".bw-title{font-size:11px;font-family:var(--mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--fg3);margin:0 0 18px}",
    ".bw-services{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}",
    ".bw-svc-card{padding:18px 16px;border:1px solid var(--line2);border-radius:11px;cursor:pointer;background:var(--bg2);transition:border-color .22s,background .22s;text-align:left}",
    ".bw-svc-card:hover,.bw-svc-card.sel{border-color:var(--fg);background:var(--bg3)}",
    ".bw-svc-card h4{margin:0 0 6px;font-size:15px;font-weight:600;letter-spacing:-.02em;color:var(--fg)}",
    ".bw-svc-card p{margin:0;font-size:13px;color:var(--fg3)}",
    ".bw-cal{user-select:none}",
    ".bw-cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}",
    ".bw-cal-nav span{font-size:15px;font-weight:600;letter-spacing:-.02em}",
    ".bw-cal-btn{background:var(--bg2);border:1px solid var(--line2);border-radius:7px;padding:6px 12px;cursor:pointer;color:var(--fg3);font-size:13px;transition:color .2s,border-color .2s}",
    ".bw-cal-btn:hover{color:var(--fg);border-color:var(--fg3)}",
    ".bw-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}",
    ".bw-cal-dow{font-size:11px;font-family:var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--fg3);text-align:center;padding:4px 0}",
    ".bw-cal-day{aspect-ratio:1;border-radius:7px;border:1px solid transparent;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:background .18s,border-color .18s;background:transparent;color:var(--fg)}",
    ".bw-cal-day:hover:not(.disabled):not(.empty){background:var(--bg2);border-color:var(--line2)}",
    ".bw-cal-day.today{border-color:var(--line2)}",
    ".bw-cal-day.sel{background:var(--fg)!important;color:var(--bg)!important;border-color:var(--fg)!important}",
    ".bw-cal-day.disabled{color:var(--fg3);opacity:.35;cursor:default}",
    ".bw-cal-day.empty{cursor:default}",
    ".bw-cal-day.no-slots{color:var(--fg3);opacity:.35;cursor:default}",
    ".bw-slots{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}",
    ".bw-slot{padding:10px 18px;border:1px solid var(--line2);border-radius:8px;cursor:pointer;font-size:14px;background:var(--bg2);color:var(--fg);transition:border-color .2s,background .2s}",
    ".bw-slot:hover,.bw-slot.sel{border-color:var(--fg);background:var(--bg3)}",
    ".bw-field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}",
    ".bw-label{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg3)}",
    ".bw-input{font-family:inherit;font-size:15px;padding:11px 13px;border-radius:9px;background:var(--bg);color:var(--fg);border:1px solid var(--line2);outline:none;width:100%;transition:border-color .2s;box-sizing:border-box}",
    ".bw-input:focus{border-color:var(--fg3)}",
    ".bw-consent{display:grid;grid-template-columns:18px 1fr;gap:10px;align-items:start;margin-bottom:18px}",
    ".bw-consent-cb{appearance:none;-webkit-appearance:none;width:18px;height:18px;margin-top:2px;border:1px solid var(--line2);border-radius:5px;background:var(--bg);cursor:pointer;position:relative;transition:background .2s,border-color .2s;flex-shrink:0}",
    ".bw-consent-cb:checked{background:var(--fg);border-color:var(--fg)}",
    ".bw-consent-cb:checked::after{content:'';position:absolute;left:5.5px;top:2px;width:4px;height:9px;border:solid var(--bg);border-width:0 2px 2px 0;transform:rotate(42deg)}",
    ".bw-consent-lbl{font-size:12.5px;line-height:1.6;color:var(--fg3);cursor:pointer}",
    ".bw-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}",
    ".bw-btn-primary{padding:12px 22px;background:var(--fg);color:var(--bg);border:1px solid var(--fg);border-radius:9px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;transition:background .2s,opacity .2s}",
    ".bw-btn-primary:hover{opacity:.9}",
    ".bw-btn-primary:disabled{opacity:.45;cursor:not-allowed}",
    ".bw-btn-ghost{padding:12px 22px;background:transparent;color:var(--fg2);border:1px solid var(--line2);border-radius:9px;font-size:14px;cursor:pointer;font-family:inherit;transition:border-color .2s,color .2s}",
    ".bw-btn-ghost:hover{border-color:var(--fg3);color:var(--fg)}",
    ".bw-confirm-box{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:28px}",
    ".bw-confirm-box h3{font-size:18px;font-weight:600;margin:0 0 18px;letter-spacing:-.02em}",
    ".bw-confirm-row{display:grid;grid-template-columns:90px 1fr;gap:8px;margin-bottom:12px;font-size:14px}",
    ".bw-confirm-key{color:var(--fg3);font-family:var(--mono,monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding-top:2px}",
    ".bw-confirm-val{color:var(--fg)}",
    ".bw-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.2);border-top-color:currentColor;border-radius:50%;animation:bw-spin .7s linear infinite;vertical-align:middle;margin-right:6px}",
    "@keyframes bw-spin{to{transform:rotate(360deg)}}",
    ".bw-notice{font-size:14px;color:var(--fg3);padding:16px 0}",
    ".bw-error{font-size:14px;color:#F87171;padding:10px 0}",
    "@media(max-width:520px){.bw-services{grid-template-columns:1fr}.bw-confirm-row{grid-template-columns:1fr;gap:3px}}",
  ].join("\n");
  document.head.appendChild(style);

  // ─── RENDER ────────────────────────────────────────────────
  function render() {
    container.innerHTML = "";
    var wrap = el("div", "bw");

    // Step dots
    var dots = el("div", "bw-steps");
    for (var i = 1; i <= 5; i++) {
      var dot = el("div", "bw-step-dot" + (i <= state.step ? " on" : ""));
      dots.appendChild(dot);
    }
    wrap.appendChild(dots);

    if (state.step === 1) renderServices(wrap);
    else if (state.step === 2) renderCalendar(wrap);
    else if (state.step === 3) renderSlots(wrap);
    else if (state.step === 4) renderDetails(wrap);
    else if (state.step === 5) renderConfirmation(wrap);

    container.appendChild(wrap);
  }

  // Step 1 — Service selection
  function renderServices(wrap) {
    wrap.appendChild(elText("p", "bw-title", "Select a service"));
    var grid = el("div", "bw-services");
    SERVICES.forEach(function (svc) {
      var card = el("div", "bw-svc-card" + (state.service === svc.label ? " sel" : ""));
      card.appendChild(elText("h4", "", svc.label));
      var meta = svc.price ? svc.duration + " · " + svc.price : svc.duration;
      card.appendChild(elText("p", "", meta));
      card.addEventListener("click", function () {
        state.service = svc.label;
        state.date = null;
        state.slot = null;
        state.step = 2;
        render();
      });
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
  }

  // Step 2 — Calendar
  function renderCalendar(wrap) {
    wrap.appendChild(elText("p", "bw-title", "Choose a date"));
    var cal = el("div", "bw-cal");

    var month = state.currentMonth;
    var year  = month.getFullYear();
    var mon   = month.getMonth();
    var today = new Date(); today.setHours(0,0,0,0);

    // Nav
    var nav = el("div", "bw-cal-nav");
    var prev = el("button", "bw-cal-btn"); prev.textContent = "←";
    prev.addEventListener("click", function () {
      var nm = new Date(year, mon - 1, 1);
      if (nm >= new Date(today.getFullYear(), today.getMonth(), 1)) {
        state.currentMonth = nm; render();
      }
    });
    var heading = el("span", ""); heading.textContent = month.toLocaleString("en-MY", { month: "long", year: "numeric" });
    var next = el("button", "bw-cal-btn"); next.textContent = "→";
    next.addEventListener("click", function () {
      state.currentMonth = new Date(year, mon + 1, 1); render();
    });
    nav.appendChild(prev); nav.appendChild(heading); nav.appendChild(next);
    cal.appendChild(nav);

    // Day-of-week headers
    var grid = el("div", "bw-cal-grid");
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(function (d) {
      grid.appendChild(elText("div", "bw-cal-dow", d));
    });

    // Blank cells before first day
    var firstDay = new Date(year, mon, 1).getDay();
    for (var b = 0; b < firstDay; b++) grid.appendChild(el("div", "bw-cal-day empty"));

    var daysInMonth = new Date(year, mon + 1, 0).getDate();
    for (var d = 1; d <= daysInMonth; d++) {
      var dateObj = new Date(year, mon, d);
      var dateStr = year + "-" + pad(mon + 1) + "-" + pad(d);
      var isPast  = dateObj < today;
      var isSel   = state.date === dateStr;
      var isToday = dateObj.getTime() === today.getTime();
      var cls     = "bw-cal-day" + (isPast ? " disabled" : "") + (isSel ? " sel" : "") + (isToday ? " today" : "");
      var cell    = elText("div", cls, String(d));

      if (!isPast) {
        (function (ds) {
          cell.addEventListener("click", function () {
            state.date = ds;
            state.slot = null;
            state.step = 3;
            fetchSlots(ds, function () { render(); });
          });
        })(dateStr);
      }
      grid.appendChild(cell);
    }

    cal.appendChild(grid);
    wrap.appendChild(cal);
    wrap.appendChild(backBtn(1));
  }

  // Step 3 — Slot selection
  function renderSlots(wrap) {
    wrap.appendChild(elText("p", "bw-title", "Pick a time on " + formatDisplayDate(state.date)));

    var cached = state.slotsCache[state.date];
    if (!cached) {
      wrap.appendChild(elText("p", "bw-notice", "Loading slots…"));
      fetchSlots(state.date, function () { render(); });
      wrap.appendChild(backBtn(2)); return;
    }

    if (!cached.length) {
      wrap.appendChild(elText("p", "bw-notice", "No slots available on this day. Please choose another date."));
      wrap.appendChild(backBtn(2)); return;
    }

    var slotWrap = el("div", "bw-slots");
    cached.forEach(function (slot) {
      var isSel = state.slot && state.slot.startTime === slot.startTime;
      var btn   = elText("div", "bw-slot" + (isSel ? " sel" : ""), formatTime(slot.startTime) + " – " + formatTime(slot.endTime));
      btn.addEventListener("click", function () {
        state.slot = slot;
        state.step = 4;
        render();
      });
      slotWrap.appendChild(btn);
    });

    wrap.appendChild(slotWrap);
    wrap.appendChild(backBtn(2));
  }

  // Step 4 — Client details
  function renderDetails(wrap) {
    wrap.appendChild(elText("p", "bw-title", "Your details"));

    var form = el("form", "");
    form.noValidate = true;

    var nameField = buildField("Name", "text", "bw-name", "Your full name", true);
    var emailField = buildField("Email address", "email", "bw-email", "your@email.com", true);
    var notesField = buildTextarea("Anything to cover?", "bw-notes", "Topics you'd like to discuss (optional)");

    var consentRow = el("div", "bw-consent");
    var cb = el("input", "bw-consent-cb"); cb.type = "checkbox"; cb.id = "bw-cb";
    var lbl = el("label", "bw-consent-lbl"); lbl.htmlFor = "bw-cb";
    lbl.textContent = "I consent to NoirTech collecting and using these details to arrange this call, in line with the Personal Data Protection Act 2010.";
    consentRow.appendChild(cb); consentRow.appendChild(lbl);

    var submitBtn = el("button", "bw-btn-primary");
    submitBtn.type = "button";
    submitBtn.textContent = "Confirm booking";
    submitBtn.disabled = true;
    cb.addEventListener("change", function () { submitBtn.disabled = !cb.checked; });

    var errMsg = el("p", "bw-error"); errMsg.style.display = "none";

    submitBtn.addEventListener("click", function () {
      var name  = nameField.querySelector("input").value.trim();
      var email = emailField.querySelector("input").value.trim();
      var notes = notesField.querySelector("textarea").value.trim();

      if (!name)  { showErr(errMsg, "Please enter your name."); return; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showErr(errMsg, "Please enter a valid email address."); return;
      }

      errMsg.style.display = "none";
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="bw-spinner"></span>Booking...';

      fetch(EDGE_URL + "/create-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientName:   name,
          clientEmail:  email,
          serviceType:  state.service,
          bookingDate:  state.date,
          startTime:    state.slot.startTime,
          endTime:      state.slot.endTime,
          slotId:       state.slot._parentSlotId || state.slot.slotId,
          notes:        notes || null,
          consentGiven: true,
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.success) {
            state._confirmedEmail = email;
            state.step = 5;
            render();
          } else {
            showErr(errMsg, data.error || "Something went wrong. Please try again.");
            submitBtn.disabled = false;
            submitBtn.textContent = "Confirm booking";
          }
        })
        .catch(function () {
          showErr(errMsg, "Network error. Please try again.");
          submitBtn.disabled = false;
          submitBtn.textContent = "Confirm booking";
        });
    });

    form.appendChild(nameField);
    form.appendChild(emailField);
    form.appendChild(notesField);
    form.appendChild(consentRow);
    form.appendChild(errMsg);

    var actions = el("div", "bw-actions");
    actions.appendChild(backBtn(3));
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    wrap.appendChild(form);
  }

  // Step 5 — Confirmation
  function renderConfirmation(wrap) {
    var box = el("div", "bw-confirm-box");
    box.appendChild(elText("h3", "", "You're booked."));

    function row(key, val) {
      var r = el("div", "bw-confirm-row");
      r.appendChild(elText("div", "bw-confirm-key", key));
      r.appendChild(elText("div", "bw-confirm-val", val));
      box.appendChild(r);
    }

    row("Service",  state.service);
    row("Date",     formatDisplayDate(state.date));
    row("Time",     formatTime(state.slot.startTime) + " – " + formatTime(state.slot.endTime) + " MYT");

    var notice = el("p", ""); notice.style.cssText = "margin:20px 0 0;font-size:13.5px;color:var(--fg3);line-height:1.6";
    notice.textContent = "A confirmation has been sent to " + (state._confirmedEmail || "your email") + ". Use the link in the email to cancel if needed.";
    box.appendChild(notice);

    var homeBtn = el("a", "bw-btn-ghost");
    homeBtn.href = "#hero";
    homeBtn.textContent = "Back to home";
    homeBtn.style.cssText = "display:inline-block;margin-top:20px;text-decoration:none;padding:12px 22px";

    wrap.appendChild(box);
    wrap.appendChild(homeBtn);
  }

  // ─── HELPERS ───────────────────────────────────────────────
  function fetchSlots(dateStr, cb) {
    if (state.slotsCache[dateStr]) { cb(); return; }
    fetch(EDGE_URL + "/get-available-slots?date=" + dateStr + "&service=" + encodeURIComponent(state.service || ""))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.slotsCache[dateStr] = data.slots || [];
        cb();
      })
      .catch(function () {
        state.slotsCache[dateStr] = [];
        cb();
      });
  }

  function backBtn(toStep) {
    var btn = elText("button", "bw-btn-ghost", "← Back");
    btn.type = "button";
    btn.style.marginTop = "18px";
    btn.addEventListener("click", function () { state.step = toStep; render(); });
    return btn;
  }

  function buildField(label, type, id, placeholder, required) {
    var wrap = el("div", "bw-field");
    var lbl  = el("label", "bw-label"); lbl.htmlFor = id; lbl.textContent = label;
    var inp  = el("input", "bw-input"); inp.type = type; inp.id = id;
    inp.placeholder = placeholder; inp.required = !!required;
    wrap.appendChild(lbl); wrap.appendChild(inp);
    return wrap;
  }

  function buildTextarea(label, id, placeholder) {
    var wrap = el("div", "bw-field");
    var lbl  = el("label", "bw-label"); lbl.htmlFor = id; lbl.textContent = label;
    var ta   = el("textarea", "bw-input"); ta.id = id; ta.placeholder = placeholder;
    ta.rows  = 3; ta.style.resize = "vertical";
    wrap.appendChild(lbl); wrap.appendChild(ta);
    return wrap;
  }

  function showErr(el, msg) { el.textContent = msg; el.style.display = "block"; }
  function el(tag, cls)     { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function elText(tag, cls, txt) { var e = el(tag, cls); e.textContent = txt; return e; }
  function pad(n)           { return String(n).padStart(2, "0"); }

  function formatTime(t) {
    var parts = t.split(":"); var h = parseInt(parts[0], 10); var m = parts[1];
    return (h % 12 || 12) + ":" + m + " " + (h >= 12 ? "PM" : "AM");
  }

  function formatDisplayDate(ds) {
    if (!ds) return "";
    return new Date(ds + "T00:00:00").toLocaleDateString("en-MY", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }

  render();
})();
