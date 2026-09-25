/* Checkout page. The Pay button stays disabled until the visible fields AND
   the card iframe both report valid; the iframe speaks postMessage. "Pay
   later" is a real button that only opens an informational modal - a decoy
   with a similar label, as enterprise checkouts love to have. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const payBtn = $("pay-now");
  let cardValid = false;
  let cardLast4 = "";

  window.addEventListener("message", (e) => {
    if (e.origin !== window.location.origin) return;
    if (!e.data || e.data.type !== "card-state") return;
    cardValid = Boolean(e.data.valid);
    cardLast4 = String(e.data.last4 || "");
    refreshPayButton();
  });

  const required = [
    ["buyer-name", (v) => v.length >= 2 || "Enter the name on the account."],
    ["buyer-email", (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || "Enter a valid email."],
    ["ship-line1", (v) => v.length >= 4 || "Enter the street address."],
    ["ship-city", (v) => v.length >= 2 || "Enter the city."],
    ["ship-postcode", (v) => /^[A-Za-z0-9 -]{4,10}$/.test(v) || "Enter a valid postcode."],
  ];

  function fieldOk(id, rule, show) {
    const value = $(id).value.trim();
    const out = rule(value);
    const ok = out === true;
    if (ok) {
      $(`${id}-error`).textContent = "";
    } else if (show || (value && $(id).dataset.touched)) {
      $(`${id}-error`).textContent = out;
    }
    return ok;
  }

  function countryOk(id, show) {
    const ok = Boolean($(id).value);
    if (show) $(`${id}-error`).textContent = ok ? "" : "Select a country.";
    else if (ok) $(`${id}-error`).textContent = "";
    return ok;
  }

  function billingNeeded() {
    return !$("billing-same").checked;
  }

  function formOk(show) {
    let ok = true;
    for (const [id, rule] of required) ok = fieldOk(id, rule, show) && ok;
    ok = countryOk("ship-country", show) && ok;
    if (billingNeeded()) {
      ok = fieldOk("bill-line1", (v) => v.length >= 4 || "Enter the street address.", show) && ok;
      ok = fieldOk("bill-city", (v) => v.length >= 2 || "Enter the city.", show) && ok;
      ok = countryOk("bill-country", show) && ok;
    }
    return ok;
  }

  function refreshPayButton() {
    payBtn.disabled = !(cardValid && formOk(false));
  }

  document.querySelector(".main").addEventListener("input", (e) => {
    if (e.target.id) e.target.dataset.touched = "1";
    refreshPayButton();
  });
  document.querySelector(".main").addEventListener("change", refreshPayButton);

  $("billing-same").addEventListener("change", () => {
    $("billing-card").classList.toggle("hidden", !billingNeeded());
    refreshPayButton();
  });

  $("pay-later").addEventListener("click", () => $("later-overlay").classList.remove("hidden"));
  $("later-close").addEventListener("click", () => $("later-overlay").classList.add("hidden"));

  payBtn.addEventListener("click", async () => {
    if (!formOk(true) || !cardValid) return;
    payBtn.disabled = true;
    payBtn.textContent = "Processing…";
    try {
      const res = await fetch("/api/payment/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: $("buyer-name").value.trim(),
          email: $("buyer-email").value.trim(),
          city: $("ship-city").value.trim(),
          country: $("ship-country").value,
          last4: cardLast4,
          amount: 24999,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "declined");
      $("receipt-no").textContent = out.receipt;
      $("receipt-detail").textContent =
        `₹24,999 charged to the card ending ${cardLast4}. A copy was emailed to ${$("buyer-email").value.trim()}.`;
      $("pay-layout").classList.add("hidden");
      $("pay-done").classList.remove("hidden");
    } catch {
      payBtn.textContent = "Pay ₹24,999";
      payBtn.disabled = false;
      $("pod-note").textContent = "Payment failed. Check the details and try again.";
    }
  });
})();
