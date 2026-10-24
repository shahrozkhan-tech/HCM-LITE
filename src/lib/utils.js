import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return "PKR " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

export function formatDate(d) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(d.length === 10 ? d + "T12:00:00" : d));
}

export function formatTime(t) {
  if (!t) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Asia/Karachi",
  }).format(new Date(t));
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function titleCase(s = "") {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function passwordGen(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$";
  let out = "";
  const cryptoObj = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : null;
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint32Array(len);
    cryptoObj.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  } else {
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
