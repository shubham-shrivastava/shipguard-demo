/* Approvals inbox. Deliberately hard for automation, correct for a human:
   every row has an "Approve" and a "Reject", both sections have an
   "Approve all", and the confirm modal's primary button says "Approve" or
   "Reject" again. State is in-memory and resets on reload. */

(() => {
  "use strict";

  const expenses = [
    { id: "EXP-1042", by: "Priya Nair", amount: 18450, status: "pending" },
    { id: "EXP-1043", by: "Tom Walker", amount: 3299, status: "pending" },
    { id: "EXP-1044", by: "Sara Iyer", amount: 76200, status: "approved" },
    { id: "EXP-1045", by: "Dev Kapoor", amount: 899, status: "pending" },
    { id: "EXP-1046", by: "Lena Fischer", amount: 12040, status: "pending" },
    { id: "EXP-1047", by: "Marco Rossi", amount: 5615, status: "rejected" },
  ];
  const invoices = [
    { id: "INV-88112", by: "Northwind Traders", amount: 240000, status: "pending" },
    { id: "INV-88113", by: "Contoso Ltd", amount: 56700, status: "pending" },
    { id: "INV-88114", by: "Fabrikam Inc", amount: 132500, status: "approved" },
    { id: "INV-88115", by: "Tailspin Toys", amount: 9990, status: "pending" },
  ];

  const fmt = (n) => "₹" + n.toLocaleString("en-IN");
  const chip = (s) =>
    s === "approved" ? '<span class="g-chip ok">Approved</span>'
    : s === "rejected" ? '<span class="g-chip bad">Rejected</span>'
    : '<span class="g-chip warn">Pending</span>';

  const overlay = document.getElementById("confirm-overlay");
  const confirmTitle = document.getElementById("confirm-title");
  const confirmBody = document.getElementById("confirm-body");
  const confirmGo = document.getElementById("confirm-go");
  const confirmCancel = document.getElementById("confirm-cancel");
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toast-text");
  const toastUndo = document.getElementById("toast-undo");

  let pendingAction = null; // { apply: () => undoState, label: string }
  let undoState = null;
  let toastTimer = null;

  function snapshot() {
    return JSON.stringify({ expenses, invoices });
  }
  function restore(snap) {
    const s = JSON.parse(snap);
    expenses.forEach((r, i) => Object.assign(r, s.expenses[i]));
    invoices.forEach((r, i) => Object.assign(r, s.invoices[i]));
  }

  function askConfirm(title, body, actionLabel, apply) {
    confirmTitle.textContent = title;
    confirmBody.textContent = body;
    confirmGo.textContent = actionLabel;
    confirmGo.classList.toggle("g-btn-danger", actionLabel === "Reject");
    confirmGo.classList.toggle("g-btn-primary", actionLabel !== "Reject");
    pendingAction = apply;
    overlay.classList.remove("hidden");
    confirmGo.focus();
  }

  function showToast(text) {
    toastText.textContent = text;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 8000);
  }

  confirmCancel.addEventListener("click", () => {
    overlay.classList.add("hidden");
    pendingAction = null;
  });
  confirmGo.addEventListener("click", () => {
    if (!pendingAction) return;
    undoState = snapshot();
    const message = pendingAction();
    pendingAction = null;
    overlay.classList.add("hidden");
    render();
    showToast(message);
  });
  toastUndo.addEventListener("click", () => {
    if (undoState) restore(undoState);
    undoState = null;
    toast.classList.add("hidden");
    render();
  });

  function rowHtml(r, kind) {
    const disabled = r.status !== "pending" ? "disabled" : "";
    return `
      <tr data-kind="${kind}" data-id="${r.id}">
        <td>${r.id}</td>
        <td>${r.by}</td>
        <td>${fmt(r.amount)}</td>
        <td>${chip(r.status)}</td>
        <td class="appr-actions">
          <button class="g-btn g-btn-sm" data-act="view">View</button>
          <button class="g-btn g-btn-sm" data-act="approve" ${disabled}>Approve</button>
          <button class="g-btn g-btn-sm g-btn-danger" data-act="reject" ${disabled}>Reject</button>
        </td>
      </tr>`;
  }

  function render() {
    document.getElementById("expense-rows").innerHTML =
      expenses.map((r) => rowHtml(r, "expense")).join("");
    document.getElementById("invoice-rows").innerHTML =
      invoices.map((r) => rowHtml(r, "invoice")).join("");
    const pending =
      expenses.filter((r) => r.status === "pending").length +
      invoices.filter((r) => r.status === "pending").length;
    document.getElementById("pending-count").textContent = `${pending} pending`;
    document.getElementById("approve-all-expenses").disabled =
      !expenses.some((r) => r.status === "pending");
    document.getElementById("approve-all-invoices").disabled =
      !invoices.some((r) => r.status === "pending");
  }

  function find(kind, id) {
    return (kind === "expense" ? expenses : invoices).find((r) => r.id === id);
  }

  document.querySelector(".main").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const tr = btn.closest("tr");
    const r = find(tr.dataset.kind, tr.dataset.id);
    const noun = tr.dataset.kind === "expense" ? "expense report" : "invoice";
    if (btn.dataset.act === "view") {
      askConfirm(
        `${r.id}`,
        `${noun[0].toUpperCase() + noun.slice(1)} from ${r.by} for ${fmt(r.amount)}. Status: ${r.status}.`,
        "Close",
        () => `Viewed ${r.id}`,
      );
      return;
    }
    const verb = btn.dataset.act === "approve" ? "Approve" : "Reject";
    askConfirm(
      `${verb} ${noun}?`,
      `${r.id} from ${r.by} for ${fmt(r.amount)} will be ${verb.toLowerCase()}${verb === "Approve" ? "d" : "ed"}. This can be undone for a few seconds.`,
      verb,
      () => {
        r.status = verb === "Approve" ? "approved" : "rejected";
        return `${r.id} ${r.status}`;
      },
    );
  });

  function approveAll(list, label) {
    const targets = list.filter((r) => r.status === "pending");
    askConfirm(
      "Approve all pending?",
      `${targets.length} pending ${label} will be approved in one action.`,
      "Approve",
      () => {
        targets.forEach((r) => (r.status = "approved"));
        return `${targets.length} ${label} approved`;
      },
    );
  }
  document.getElementById("approve-all-expenses").addEventListener("click", () =>
    approveAll(expenses, "expense reports"),
  );
  document.getElementById("approve-all-invoices").addEventListener("click", () =>
    approveAll(invoices, "invoices"),
  );

  render();
})();
