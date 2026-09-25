/* Corporate travel request wizard. Hard-for-automation, correct-for-humans:
   - the employee ID verifies asynchronously against /api/wizard/employee;
   - the policy acknowledgement stays disabled until the policy panel itself
     is scrolled to the bottom (the page does not scroll, the panel does);
   - a session-expiry modal interrupts the flow ~25 s in and must be
     dismissed with "Stay signed in" to continue;
   - the final submit posts to the server and shows a reference. */

(() => {
  "use strict";

  const data = {
    employeeId: "", employeeName: "", department: "", email: "",
    from: "", to: "", depart: "", ret: "", purpose: "",
    costCenter: "",
  };
  let employeeOk = false;

  const $ = (id) => document.getElementById(id);

  function show(n) {
    for (const s of [1, 2, 3, 4]) $(`step-${s}`).classList.add("hidden");
    $("step-done").classList.add("hidden");
    $(n === "done" ? "step-done" : `step-${n}`).classList.remove("hidden");
    document.querySelectorAll(".wiz-step-pill").forEach((p) => {
      const s = Number(p.dataset.step);
      p.classList.toggle("active", s === n);
      p.classList.toggle("done", n !== "done" && s < n);
      p.disabled = n === "done" || s > n;
    });
  }
  $("stepper").addEventListener("click", (e) => {
    const pill = e.target.closest(".wiz-step-pill.done");
    if (pill) show(Number(pill.dataset.step));
  });

  // ── Step 1: async employee verification ──
  let verifySeq = 0;
  const empStatus = $("employee-status");
  $("employee-id").addEventListener("input", () => {
    employeeOk = false;
    empStatus.textContent = "";
    empStatus.className = "verify-status";
  });
  $("employee-id").addEventListener("blur", verifyEmployee);
  async function verifyEmployee() {
    const id = $("employee-id").value.trim();
    if (!id) return;
    const seq = ++verifySeq;
    empStatus.textContent = "Checking the directory…";
    empStatus.className = "verify-status busy";
    try {
      const res = await fetch(`/api/wizard/employee?id=${encodeURIComponent(id)}`);
      const out = await res.json();
      if (seq !== verifySeq) return; // a newer check superseded this one
      if (out.ok) {
        employeeOk = true;
        data.employeeId = id;
        data.employeeName = out.name;
        empStatus.textContent = `Verified: ${out.name}`;
        empStatus.className = "verify-status ok";
      } else {
        empStatus.textContent = out.error;
        empStatus.className = "verify-status err";
      }
    } catch {
      if (seq !== verifySeq) return;
      empStatus.textContent = "Directory is unreachable. Try again.";
      empStatus.className = "verify-status err";
    }
  }

  $("next-1").addEventListener("click", async () => {
    if (!employeeOk) await verifyEmployee();
    let ok = employeeOk;
    if (!employeeOk && !empStatus.textContent) {
      empStatus.textContent = "Employee ID is required.";
      empStatus.className = "verify-status err";
    }
    data.department = $("department").value;
    $("department-error").textContent = data.department ? "" : "Select a department.";
    ok = ok && !!data.department;
    const email = $("work-email").value.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    $("work-email-error").textContent = emailOk ? "" : "Enter a valid work email.";
    data.email = email;
    ok = ok && emailOk;
    if (ok) show(2);
  });

  // ── Step 2: trip ──
  $("back-2").addEventListener("click", () => show(1));
  $("next-2").addEventListener("click", () => {
    let ok = true;
    data.from = $("from-city").value.trim();
    data.to = $("to-city").value.trim();
    $("from-city-error").textContent = data.from ? "" : "Required.";
    $("to-city-error").textContent =
      !data.to ? "Required."
      : data.to.toLowerCase() === data.from.toLowerCase() ? "Destination must differ from origin."
      : "";
    ok = ok && !!data.from && !!data.to && data.to.toLowerCase() !== data.from.toLowerCase();
    data.depart = $("depart-date").value;
    data.ret = $("return-date").value;
    $("depart-date-error").textContent = data.depart ? "" : "Required.";
    $("return-date-error").textContent =
      !data.ret ? "Required."
      : data.ret < data.depart ? "Return cannot be before departure."
      : "";
    ok = ok && !!data.depart && !!data.ret && data.ret >= data.depart;
    const purpose = document.querySelector('input[name="purpose"]:checked');
    $("purpose-error").textContent = purpose ? "" : "Pick a purpose.";
    data.purpose = purpose ? purpose.value : "";
    ok = ok && !!purpose;
    if (ok) show(3);
  });

  // ── Step 3: policy scroll gate + cost center ──
  const scroller = $("policy-scroll");
  scroller.addEventListener("scroll", () => {
    const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
    if (atEnd && $("accept-policy").disabled) {
      $("accept-policy").disabled = false;
      $("accept-hint").textContent = "Thanks for reading.";
    }
  });
  $("back-3").addEventListener("click", () => show(2));
  $("next-3").addEventListener("click", () => {
    let ok = true;
    if (!$("accept-policy").checked) {
      $("accept-hint").textContent = $("accept-policy").disabled
        ? "Scroll the policy to the bottom to enable this."
        : "You must accept the policy to continue.";
      ok = false;
    }
    const cc = $("cost-center").value.trim().toUpperCase();
    const ccOk = /^CC-\d{4}$/.test(cc);
    $("cost-center-error").textContent = ccOk ? "" : "Use the format CC-1234.";
    data.costCenter = cc;
    ok = ok && ccOk;
    if (ok) {
      renderReview();
      show(4);
    }
  });

  // ── Step 4: review + submit ──
  function renderReview() {
    const rows = [
      ["Traveller", `${data.employeeName} (${data.employeeId})`],
      ["Department", data.department],
      ["Email", data.email],
      ["Route", `${data.from} → ${data.to}`],
      ["Dates", `${data.depart} to ${data.ret}`],
      ["Purpose", data.purpose],
      ["Cost center", data.costCenter],
    ];
    $("review-list").innerHTML = rows
      .map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`)
      .join("");
  }
  $("back-4").addEventListener("click", () => show(3));
  $("submit-request").addEventListener("click", async () => {
    const btn = $("submit-request");
    btn.disabled = true;
    btn.textContent = "Submitting…";
    try {
      const res = await fetch("/api/wizard/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "failed");
      $("request-ref").textContent = out.reference;
      show("done");
    } catch {
      btn.disabled = false;
      btn.textContent = "Submit request";
      alertless("Submission failed. Try again.");
    }
  });
  function alertless(text) {
    // Never window.alert: it would block automation entirely. A toast will do.
    const t = document.createElement("div");
    t.className = "g-toast";
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ── Session expiry interruption ──
  const overlay = $("session-overlay");
  let countdown = null;
  let shows = 0;
  function openSessionModal() {
    if (shows >= 2 || !$("step-done").classList.contains("hidden")) return;
    shows += 1;
    let secs = 30;
    $("session-secs").textContent = String(secs);
    overlay.classList.remove("hidden");
    countdown = setInterval(() => {
      secs -= 1;
      $("session-secs").textContent = String(secs);
      if (secs <= 0) signOut();
    }, 1000);
  }
  function closeSessionModal() {
    clearInterval(countdown);
    overlay.classList.add("hidden");
  }
  function signOut() {
    closeSessionModal();
    window.location.reload();
  }
  $("session-stay").addEventListener("click", () => {
    closeSessionModal();
    setTimeout(openSessionModal, 90000);
  });
  $("session-signout").addEventListener("click", signOut);
  setTimeout(openSessionModal, 25000);

  show(1);
})();
