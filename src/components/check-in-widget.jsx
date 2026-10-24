"use client";

import { useState } from "react";
import { LogIn, LogOut, Camera, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { CameraCheckIn } from "@/components/camera-checkin";
import { useGetTodayQuery, useCheckInMutation, useCheckOutMutation } from "@/store/api";
import { sweetSuccess } from "@/lib/alerts";
import { formatTime, cn } from "@/lib/utils";

/** Employee check-in/out widget (M4) with optional camera mode (bonus). */
export function CheckInWidget({ compact = false }) {
  const { data, isLoading, refetch } = useGetTodayQuery();
  const [checkIn, { isLoading: inLoading }] = useCheckInMutation();
  const [checkOut, { isLoading: outLoading }] = useCheckOutMutation();
  const [cameraOpen, setCameraOpen] = useState(false);

  const doCheckIn = async () => {
    try {
      const res = await checkIn({ source: "web" }).unwrap();
      sweetSuccess(
        res.attendance.status === "late" ? "Checked in — but you're late ⏰" : "Checked in ✅",
        `Server time <b>${formatTime(res.attendance.check_in)}</b> · status <b>${res.attendance.status}</b>`
      );
      refetch();
    } catch {
      /* toast from base query */
    }
  };

  const doCheckOut = async () => {
    try {
      const res = await checkOut().unwrap();
      sweetSuccess(
        res.attendance.status === "half_day" ? "Checked out — half day" : "Checked out 🎉",
        res.attendance.status === "half_day"
          ? `Worked <b>${res.workedHours} h</b> (under the ${res.halfDayThreshold} h threshold → half day)`
          : `Worked <b>${res.workedHours} h</b> today — nice work!`
      );
      refetch();
    } catch {
      /* toast from base query */
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading today…
        </CardContent>
      </Card>
    );
  }

  const att = data?.attendance;
  const waiting = data?.canCheckIn;

  return (
    <Card className={cn("relative overflow-hidden", waiting && "ring-glow")}>
      <div className="bg-brand-gradient-soft pointer-events-none absolute inset-x-0 top-0 h-24" />
      <CardHeader className={cn("relative", compact && "pb-2")}>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white shadow">
            <Clock className="h-4 w-4" />
          </span>
          Today · {data?.date}
        </CardTitle>
        <CardDescription>
          Office {data?.officeStart} · grace {data?.graceMinutes} min · local time {data?.localTime}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {att ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm animate-fade-in">
            <StatusBadge status={att.status} />
            {att.source === "camera" && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">📷 camera</span>
            )}
            <div>
              <span className="text-muted-foreground">In:</span>{" "}
              <span className="font-semibold">{formatTime(att.check_in)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Out:</span>{" "}
              <span className="font-semibold">{att.check_out ? formatTime(att.check_out) : "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hours:</span>{" "}
              <span className="font-semibold">{att.work_hours ?? "—"}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No record yet — check in to start your day. 💪</p>
        )}

        <div className="flex flex-wrap gap-2">
          {data?.canCheckIn && (
            <>
              <Button
                onClick={doCheckIn}
                disabled={inLoading}
                size="lg"
                className="gap-2 rounded-xl"
              >
                {inLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Check in
              </Button>
              <Button
                variant="outline"
                onClick={() => setCameraOpen(true)}
                className="gap-2 rounded-xl"
                title="Face detection + office geofence (bonus)"
              >
                <Camera className="h-4 w-4" /> Camera check-in
              </Button>
            </>
          )}
          {data?.canCheckOut && (
            <Button
              variant="secondary"
              onClick={doCheckOut}
              disabled={outLoading}
              size="lg"
              className="gap-2 rounded-xl"
            >
              {outLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Check out
            </Button>
          )}
          {!data?.canCheckIn && !data?.canCheckOut && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="h-4 w-4" /> Day complete.
            </p>
          )}
        </div>
      </CardContent>

      <CameraCheckIn
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        radius={data?.geofenceRadius}
        officeSet={Boolean(data?.cameraEnabled)}
        onDone={refetch}
      />
    </Card>
  );
}
