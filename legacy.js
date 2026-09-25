/* Client wiring for the WebForms emulation: changing the country fires a
   full-page postback (__EVENTTARGET + form.submit), exactly like
   __doPostBack. CSP forbids inline handlers, so the wiring lives here. */

(() => {
  "use strict";
  const form = document.getElementById("aspnetForm");
  if (!form) return;
  const target = document.getElementById("__EVENTTARGET");

  function doPostBack(eventTarget) {
    target.value = eventTarget;
    form.submit();
  }

  const country = document.getElementById("ctl00_Main_ddlCountry");
  if (country) {
    country.addEventListener("change", () => doPostBack("ctl00$Main$ddlCountry"));
  }

  const refresh = document.getElementById("ctl00_Main_btnRefresh");
  if (refresh) {
    refresh.addEventListener("click", () => doPostBack("ctl00$Main$btnRefresh"));
  }

  const reset = () => {
    window.location.href = "/legacy";
  };
  const btnNew = document.getElementById("ctl00_Main_btnNew");
  if (btnNew) btnNew.addEventListener("click", reset);
  const btnCancel = document.getElementById("ctl00_Main_btnCancel");
  if (btnCancel) btnCancel.addEventListener("click", reset);
})();
