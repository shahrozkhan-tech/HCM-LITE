"use client";

import Swal from "sweetalert2";

/**
 * SweetAlert2 wrapper with the HCM Lite brand theme (light + dark).
 * Usage:
 *   import { sweetSuccess, sweetError, sweetInfo, confirmAction, sweetCreds } from "@/lib/alerts";
 */

let mixin = null;

function base() {
  if (!mixin) {
    mixin = Swal.mixin({
      customClass: {
        confirmButton: "swal-btn-brand",
        cancelButton: "swal-btn-ghost",
        denyButton: "swal-btn-danger",
      },
      buttonsStyling: true,
      showClass: { popup: "animate-scale-in" },
      hideClass: { popup: "" },
    });
  }
  return mixin;
}

export function sweetSuccess(title, html = "") {
  return base().fire({
    icon: "success",
    title,
    html,
    timer: 2600,
    showConfirmButton: false,
  });
}

export function sweetError(title, html = "") {
  return base().fire({ icon: "error", title, html, confirmButtonText: "Okay" });
}

export function sweetInfo(title, html = "") {
  return base().fire({ icon: "info", title, html, confirmButtonText: "Got it" });
}

export function sweetWarning(title, html = "") {
  return base().fire({ icon: "warning", title, html, confirmButtonText: "Okay" });
}

/** Themed confirm dialog → resolves true/false. */
export async function confirmAction({
  title,
  html = "",
  confirmText = "Yes, continue",
  cancelText = "Cancel",
  danger = false,
  icon = "question",
}) {
  const res = await base().fire({
    icon: danger ? "warning" : icon,
    title,
    html,
    showCancelButton: true,
    confirmButtonText: danger ? "Yes, do it" : confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
  });
  return res.isConfirmed;
}

/** Success dialog that shows a temporary password / credential once. */
export async function sweetCreds({ title, html, code, codeLabel = "Temporary password" }) {
  return base().fire({
    icon: "success",
    title,
    html: `${html}<div style="margin-top:14px"><div style="font-size:12px;opacity:.7;margin-bottom:6px">${codeLabel} (shown once — copy it now)</div><span class="swal-code">${code}</span></div>`,
    confirmButtonText: "Copy & close",
    showCancelButton: true,
    cancelButtonText: "Close",
  }).then((r) => {
    if (r.isConfirmed && code) {
      try { navigator.clipboard.writeText(code); } catch { /* older browsers */ }
    }
    return r;
  });
}
