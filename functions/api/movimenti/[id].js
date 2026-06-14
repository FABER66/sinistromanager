import { getUser, json, unauthorized } from '../../_lib/auth.js';

// DELETE /api/movimenti/:id
export async function onRequestDelete(context) {
  const u = await getUser(context);
  if (!u) return unauthorized();
  if (u.ruolo !== 'admin') return json({ error: 'Permesso negato' }, { status: 403 });
  await context.env.DB.prepare('DELETE FROM sin_movimenti WHERE id=?').bind(context.params.id).run();
  return json({ ok: true });
}
