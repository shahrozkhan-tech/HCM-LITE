"use client";

import { useEffect } from "react";

/** Registers the PWA service worker (network-only passthrough). */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* PWA is a bonus — never block the app */
      });
    }
  }, []);
  return null;
}
