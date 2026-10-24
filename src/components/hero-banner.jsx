"use client";

import { CalendarDays } from "lucide-react";

/** Gradient hero banner greeting the user on each dashboard. */
export function HeroBanner({ name, roleLabel, children, icon }) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Karachi" }).format(new Date())
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi",
  }).format(new Date());

  return (
    <div className="bg-brand-gradient relative mb-6 overflow-hidden rounded-2xl p-5 md:p-6 text-white shadow-lg animate-fade-up">
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-fuchsia-300/20 blur-2xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg md:text-2xl font-extrabold tracking-tight drop-shadow-sm">
              {greeting}, {name?.split(" ")[0] || "there"} 👋
            </h1>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider backdrop-blur">
              {roleLabel}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs md:text-sm text-white/85">
            <CalendarDays className="h-3.5 w-3.5" /> {dateStr}
          </p>
        </div>
        {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
