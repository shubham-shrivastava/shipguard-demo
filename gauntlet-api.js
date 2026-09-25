/* APIs behind the gauntlet pages: the travel wizard's employee directory
   check and submission, and the checkout's charge endpoint. Latency is
   jittered so loading states are real; tests pass delayMs: () => 0. */
const express = require("express");
const crypto = require("crypto");

const EMPLOYEES = {
  "E-10423": "Priya Nair",
  "E-10561": "Tom Walker",
  "E-11007": "Sara Iyer",
  "E-11238": "Dev Kapoor",
  "E-11540": "Lena Fischer",
};

function jitter(min = 400, max = 1400) {
  return () => min + Math.floor(Math.random() * (max - min + 1));
}

function reference(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${prefix}-${out.slice(0, 6)}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {{delayMs?: () => number}} [options] */
function createGauntletRouter(options = {}) {
  const delayMs = options.delayMs || jitter();
  const router = express.Router();
  router.use(express.json());

  router.get("/wizard/employee", async (req, res) => {
    await sleep(delayMs());
    const id = String(req.query.id || "").trim().toUpperCase();
    if (!/^E-\d{5}$/.test(id)) {
      res.json({ ok: false, error: "Employee IDs look like E-10423." });
      return;
    }
    const name = EMPLOYEES[id];
    if (!name) {
      res.json({ ok: false, error: `No employee ${id} in the directory.` });
      return;
    }
    res.json({ ok: true, name });
  });

  router.post("/wizard/submit", async (req, res) => {
    await sleep(delayMs());
    const b = req.body || {};
    const problems = [];
    if (!EMPLOYEES[String(b.employeeId || "").toUpperCase()]) problems.push("employeeId");
    if (!b.from || !b.to) problems.push("route");
    if (!b.depart || !b.ret || b.ret < b.depart) problems.push("dates");
    if (!/^CC-\d{4}$/.test(b.costCenter || "")) problems.push("costCenter");
    if (problems.length) {
      res.status(422).json({ error: `Invalid fields: ${problems.join(", ")}` });
      return;
    }
    res.json({ reference: reference("TR") });
  });

  router.post("/payment/checkout", async (req, res) => {
    await sleep(delayMs());
    const b = req.body || {};
    if (!b.name || !b.email || !b.country || !/^\d{4}$/.test(b.last4 || "") || b.amount !== 24999) {
      res.status(422).json({ error: "The charge request is incomplete." });
      return;
    }
    res.json({ receipt: reference("RCP") });
  });

  return router;
}

module.exports = { createGauntletRouter, EMPLOYEES };
