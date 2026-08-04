// contact-form.js
// Drop this file into your GitHub repo root.
// Then add at the bottom of index.html, just before </body>:
//   <script src="contact-form.js"></script>
// This replaces the Web3Forms logic — remove the Web3Forms fetch from the inline script.

(function () {
  "use strict";

  var EDGE_URL = "https://lzxiwmhvvnvalgglczit.supabase.co/functions/v1";

  var form    = document.getElementById("form");
  var sendBtn = document.getElementById("sendBtn");
  var toast   = document.getElementById("toast");

  if (!form || !sendBtn) return; // not on a page that has the form

  // Toast helper (reuse existing site toast)
  var toastTimer;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("on"); }, 4200);
  }

  var origBtnHTML = sendBtn.innerHTML;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var name    = (form.elements["name"]    || {}).value || "";
    var contact = (form.elements["contact"] || {}).value || "";
    var message = (form.elements["message"] || {}).value || "";
    var consent = form.elements["consent"] ? form.elements["consent"].checked : false;

    // Client-side validation
    if (!name.trim())    { showToast("Please add your name.");                      return; }
    if (!contact.trim()) { showToast("Please add an email or phone number.");       return; }
    if (!message.trim()) { showToast("Please tell us what you need.");              return; }
    if (!consent)        { showToast("Please tick the consent box so we can reply."); return; }

    // Honeypot
    var hp = form.elements["botcheck"];
    if (hp && hp.checked) return;

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    fetch(EDGE_URL + "/submit-enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:          name.trim(),
        contact:       contact.trim(),
        message:       message.trim(),
        consent_given: true,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          form.reset();
          showToast("Message sent. We will get back to you asap.");
        } else {
          showToast(data.error || "Something went wrong. Please WhatsApp us instead.");
        }
      })
      .catch(function () {
        showToast("Network problem. Please WhatsApp us instead.");
      })
      .finally(function () {
        sendBtn.disabled = false;
        sendBtn.innerHTML = origBtnHTML;
      });
  });
})();
