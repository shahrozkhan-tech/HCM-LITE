/** Audit log helper (M9): every create/update/approve/finalize action. */
export async function writeAudit(admin, actor, action, entity, entityId, before, after) {
  try {
    await admin.from("audit_logs").insert({
      actor_id: actor?.id ?? null,
      actor_name: actor?.full_name ?? actor?.email ?? "system",
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
      before: before ?? null,
      after: after ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write log", err);
  }
}

/** In-app notification helper (M9). */
export async function notify(admin, userId, title, body) {
  if (!userId) return;
  try {
    await admin.from("notifications").insert({ user_id: userId, title, body: body ?? "" });
  } catch (err) {
    console.error("[notify] failed", err);
  }
}
