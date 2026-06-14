import { getUser } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const u = await getUser(context);
  if (!u) return new Response('Non autorizzato', { status: 401 });

  const segs = context.params.path; // catch-all → array
  const key = Array.isArray(segs) ? segs.join('/') : segs;
  if (!key) return new Response('Not found', { status: 404 });

  const obj = await context.env.DOCS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'private, max-age=3600');
  return new Response(obj.body, { headers });
}
