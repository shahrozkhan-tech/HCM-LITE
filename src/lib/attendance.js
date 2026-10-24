import { AppError } from "@/lib/api";
import {
  getHolidaySet,
  getSettings,
  isWeekend,
  localMinutes,
  localDateStr,
  datesBetween,
} from "@/lib/dates";

/**
 * Attendance rules (M4):
 *  - server stamps every time; clients only send location/face metadata
 *  - one record per employee per day (second check-in → 409)
 *  - late  = check-in after office_start + grace (e.g. 09:00 + 15 = 09:15)
 *  - half_day = worked under half_day_hours (5 h)
 *  - absent = no record on a working day and no approved leave
 *  - missing_checkout = checked in but never checked out
 */

export function computeCheckInStatus(settings) {
  const [h, m] = settings.office_start.split(":").map(Number);
  const lateAfter = h * 60 + m + settings.grace_minutes;
  return localMinutes(new Date(), settings.timezone) > lateAfter ? "late" : "present";
}

export function hoursBetween(inIso, outIso) {
  return Math.max(0, (new Date(outIso).getTime() - new Date(inIso).getTime()) / 3_600_000);
}

export function computeCheckOutStatus(current, hours, settings) {
  if (hours < Number(settings.half_day_hours)) return "half_day";
  return current === "late" ? "late" : "present";
}

/** Haversine distance in metres. */
export function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Back-fills `absent` / `on_leave` rows for every past working day in
 * [from, to] where an employee has no record, and flips open check-ins on
 * past days to `missing_checkout`. Idempotent — safe before any read.
 */
export async function materializeAttendance(admin, from, to) {
  const settings = await getSettings(admin);
  const today = localDateStr(new Date(), settings.timezone);
  const effectiveTo = to < today ? to : today;
  if (from > effectiveTo) return;

  const holidays = await getHolidaySet(admin, from, effectiveTo);
  const days = datesBetween(from, effectiveTo).filter(
    (d) => !isWeekend(d, settings.weekend_days) && !holidays.has(d)
  );
  if (!days.length) return;

  const { data: employees } = await admin
    .from("employees")
    .select("id, join_date, exit_date, status")
    .in("status", ["active", "probation"]);
  if (!employees?.length) return;

  const { data: existing } = await admin
    .from("attendance")
    .select("id, employee_id, date, status, check_in, check_out")
    .gte("date", from)
    .lte("date", effectiveTo);

  const { data: leaves } = await admin
    .from("leaves")
    .select("employee_id, start_date, end_date")
    .eq("status", "approved")
    .lte("start_date", effectiveTo)
    .gte("end_date", from);

  const byKey = new Map((existing ?? []).map((r) => [`${r.employee_id}|${r.date}`, r]));
  const leaveDays = new Set();
  for (const l of leaves ?? []) {
    for (const d of datesBetween(l.start_date, l.end_date)) {
      if (d >= from && d <= effectiveTo) leaveDays.add(`${l.employee_id}|${d}`);
    }
  }

  const upserts = [];
  for (const emp of employees) {
    for (const day of days) {
      if (day < emp.join_date) continue;
      if (emp.exit_date && day > emp.exit_date) continue;
      const key = `${emp.id}|${day}`;
      const rec = byKey.get(key);
      if (!rec) {
        upserts.push({
          employee_id: emp.id,
          date: day,
          status: leaveDays.has(key) ? "on_leave" : "absent",
          work_hours: 0,
        });
      } else if (
        day < today &&
        rec.check_in &&
        !rec.check_out &&
        rec.status !== "missing_checkout" &&
        rec.status !== "on_leave"
      ) {
        const hrs = Math.min(hoursBetween(rec.check_in, new Date().toISOString()), 9);
        upserts.push({
          employee_id: rec.employee_id,
          date: rec.date,
          status: "missing_checkout",
          work_hours: hrs,
        });
      }
    }
  }

  const CHUNK = 500;
  for (let i = 0; i < upserts.length; i += CHUNK) {
    await admin
      .from("attendance")
      .upsert(upserts.slice(i, i + CHUNK), { onConflict: "employee_id,date" });
  }
}

/** Validates camera + geofence metadata from the client (bonus feature). */
export function validateCameraCheckIn(body, settings) {
  if (body.faceCount !== 1) {
    throw new AppError(400, "Camera check-in requires exactly one face in the frame.");
  }
  if (
    typeof body.lat !== "number" ||
    typeof body.lng !== "number" ||
    typeof body.accuracy !== "number"
  ) {
    throw new AppError(400, "Location (lat, lng, accuracy) is required for camera check-in.");
  }
  if (body.accuracy > 100) {
    throw new AppError(400, "GPS accuracy worse than 100 m — move outdoors and retry.");
  }
  if (settings.office_lat == null || settings.office_lng == null) {
    throw new AppError(
      400,
      "Admin has not set the office location yet — use web check-in instead."
    );
  }
  const dist = haversineMetres(body.lat, body.lng, settings.office_lat, settings.office_lng);
  if (dist > settings.geofence_radius) {
    throw new AppError(
      400,
      `You are ${Math.round(dist)} m from the office (allowed ${settings.geofence_radius} m). Check in from inside the office.`
    );
  }
  return { distance: Math.round(dist) };
}
