"use client";

import { useMemo } from "react";
import { Cake, PartyPopper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useGetEmployeesQuery } from "@/store/api";
import { initials } from "@/lib/utils";

const WINDOW_DAYS = 30;

/** Next occurrence of an MM-DD within WINDOW_DAYS, or null. */
function nextOccurrence(dateStr, today) {
  if (!dateStr) return null;
  const md = dateStr.slice(5, 10);
  const thisYear = today.slice(0, 4);
  let candidate = `${thisYear}-${md}`;
  if (candidate < today) {
    candidate = `${Number(thisYear) + 1}-${md}`;
  }
  const diff = Math.round(
    (new Date(candidate + "T12:00:00") - new Date(today + "T12:00:00")) / 86400000
  );
  return diff <= WINDOW_DAYS ? { date: candidate, days: diff } : null;
}

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const fmtDay = (d) => fmt.format(new Date(d + "T12:00:00"));

/**
 * Birthdays & work anniversaries in the next 30 days — from the live
 * employee directory (staff roles only).
 */
export function CelebrationsWidget() {
  const { data } = useGetEmployeesQuery({ pageSize: 50 });
  const today = new Date().toISOString().slice(0, 10);

  const { birthdays, anniversaries } = useMemo(() => {
    const people = (data?.rows ?? []).filter((p) => p.status !== "exited");
    const bdays = [];
    const anniv = [];
    for (const p of people) {
      const b = nextOccurrence(p.dob, today);
      if (b) {
        bdays.push({
          id: p.id, name: `${p.first_name} ${p.last_name}`.trim(),
          date: b.date, days: b.days,
          turning: Number(b.date.slice(0, 4)) - Number(p.dob.slice(0, 4)),
          dept: p.departments?.name ?? "",
        });
      }
      const a = nextOccurrence(p.join_date, today);
      if (a && a.days > 0) {
        anniv.push({
          id: p.id, name: `${p.first_name} ${p.last_name}`.trim(),
          date: a.date, days: a.days,
          years: Number(a.date.slice(0, 4)) - Number(p.join_date.slice(0, 4)),
          dept: p.departments?.name ?? "",
        });
      }
    }
    bdays.sort((x, y) => x.days - y.days);
    anniv.sort((x, y) => x.days - y.days);
    return { birthdays: bdays.slice(0, 4), anniversaries: anniv.slice(0, 4) };
  }, [data, today]);

  const empty = birthdays.length === 0 && anniversaries.length === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <PartyPopper className="h-4 w-4 text-primary" /> Celebrations — next 30 days
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {empty && (
          <p className="py-2 text-sm text-muted-foreground">
            No birthdays or anniversaries in the next 30 days. Add <b>date of birth</b> and{" "}
            <b>join date</b> on employee records to see them here.
          </p>
        )}
        {birthdays.map((b) => (
          <div key={`b-${b.id}`} className="flex items-center gap-3 text-sm">
            <Avatar className="h-8 w-8 border border-primary/30">
              <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                {initials(b.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{b.name}</p>
              <p className="text-[11px] text-muted-foreground">{b.dept}</p>
            </div>
            <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-600 dark:text-fuchsia-300">
              <Cake className="h-3 w-3" /> {fmtDay(b.date)} · turns {b.turning}
            </span>
          </div>
        ))}
        {anniversaries.map((a) => (
          <div key={`a-${a.id}`} className="flex items-center gap-3 text-sm">
            <Avatar className="h-8 w-8 border border-success/30">
              <AvatarFallback className="bg-success/10 text-[10px] font-bold text-success">
                {initials(a.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{a.name}</p>
              <p className="text-[11px] text-muted-foreground">{a.dept}</p>
            </div>
            <span className="ml-auto shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
              {a.years} {a.years === 1 ? "year" : "years"} · {fmtDay(a.date)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
