/* Card fields inside the same-origin payment iframe. Formats the number in
   groups of four, validates with Luhn, and reports validity + last4 to the
   parent page with postMessage - the Stripe Elements pattern. */

(() => {
  "use strict";

  const number = document.getElementById("card-number");
  const expiry = document.getElementById("card-expiry");
  const cvc = document.getElementById("card-cvc");

  function luhnOk(digits) {
    let sum = 0;
    let dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = Number(digits[i]);
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  function checkNumber() {
    const digits = number.value.replace(/\D/g, "");
    if (digits.length === 0) return "";
    if (digits.length < 16) return "Card number is incomplete.";
    if (!luhnOk(digits)) return "This card number is not valid.";
    return null; // valid
  }
  function checkExpiry() {
    const m = expiry.value.match(/^(\d{2})\/(\d{2})$/);
    if (!expiry.value) return "";
    if (!m) return "Use MM/YY.";
    const month = Number(m[1]);
    const year = 2000 + Number(m[2]);
    if (month < 1 || month > 12) return "Month must be 01-12.";
    // The demo clock: anything before Oct 2026 is expired.
    if (year < 2026 || (year === 2026 && month < 10)) return "This card has expired.";
    return null;
  }
  function checkCvc() {
    if (!cvc.value) return "";
    return /^\d{3,4}$/.test(cvc.value) ? null : "3 or 4 digits.";
  }

  function report() {
    const results = [
      ["card-number", checkNumber()],
      ["card-expiry", checkExpiry()],
      ["card-cvc", checkCvc()],
    ];
    for (const [id, err] of results) {
      document.getElementById(`${id}-error`).textContent = err || "";
    }
    const valid = results.every(([, err]) => err === null);
    window.parent.postMessage(
      {
        type: "card-state",
        valid,
        last4: valid ? number.value.replace(/\D/g, "").slice(-4) : "",
      },
      window.location.origin,
    );
  }

  number.addEventListener("input", () => {
    const digits = number.value.replace(/\D/g, "").slice(0, 16);
    number.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
    report();
  });
  expiry.addEventListener("input", () => {
    let v = expiry.value.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    expiry.value = v;
    report();
  });
  cvc.addEventListener("input", report);
  for (const el of [number, expiry, cvc]) el.addEventListener("blur", report);

  report();
})();
