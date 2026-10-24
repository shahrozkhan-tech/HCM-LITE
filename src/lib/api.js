import { NextResponse } from "next/server";

/** Error with an HTTP status, thrown by services and mapped by `route()`. */
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}

/** Wraps a route handler: AppError → its status, anything else → 500. */
export async function route(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api]", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new AppError(400, "Invalid JSON body");
  }
}

export function requireFields(body, fields) {
  const missing = fields.filter(
    (f) => body?.[f] === undefined || body?.[f] === null || body?.[f] === ""
  );
  if (missing.length) {
    throw new AppError(400, `Missing required field(s): ${missing.join(", ")}`);
  }
}
