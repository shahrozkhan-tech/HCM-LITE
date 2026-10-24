"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Smooth count-up for numeric values. */
function useCountUp(target, duration = 850) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (typeof target !== "number" || Number.isNaN(target)) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

const TONES = {
  default: { chip: "from-indigo-500 to-violet-500", text: "text-foreground" },
  primary: { chip: "from-indigo-500 to-violet-500", text: "text-primary" },
  success: { chip: "from-emerald-500 to-teal-500", text: "text-success" },
  warning: { chip: "from-amber-500 to-orange-500", text: "text-warning" },
  destructive: { chip: "from-rose-500 to-red-500", text: "text-destructive" },
};

export function StatCard({ label, value, sub, icon: Icon, tone = "default", className, animateCount = true }) {
  const t = TONES[tone] ?? TONES.default;
  const numeric = typeof value === "number" && Number.isFinite(value);
  const animated = useCountUp(numeric && animateCount ? value : 0);
  const display = numeric
    ? Number.isInteger(value)
      ? Math.round(animated).toLocaleString()
      : animated.toFixed(value % 1 === 0 || !Number.isInteger(value) ? 1 : 0)
    : value;

  return (
    <Card className={cn("group relative overflow-hidden", className)}>
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-[0.07] transition-transform duration-500 group-hover:scale-150 from-indigo-500 to-fuchsia-500" />
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn("mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums", t.text)}>
              {display}
            </p>
            {sub && <p className="mt-1 text-[11px] text-muted-foreground truncate">{sub}</p>}
          </div>
          {Icon && (
            <div
              className={cn(
                "shrink-0 rounded-xl bg-gradient-to-br p-2.5 text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
                t.chip
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
