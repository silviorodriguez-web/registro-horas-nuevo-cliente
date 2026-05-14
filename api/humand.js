// api/humand.js — Proxy seguro hacia Humand API
export const config = { api: { bodyParser: false } };

const HUMAND_BASE = 'https://api-prod.humand.co/public/api/v1';

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const key = process.env.HUMAND_API_KEY;
  if (!key) { res.status(500).json({ error: 'HUMAND_API_KEY no configurada' }); return; }

  const { path, ...queryParams } = req.query;
  if (!path) { res.status(400).json({ error: 'Falta parametro path' }); return; }

  const qs  = new URLSearchParams(queryParams).toString();
  const url = `${HUMAND_BASE}${path}${qs ? '?' + qs : ''}`;

  try {
    const opts = {
      method: req.method,
      headers: { 'Authorization': `Basic ${key}` },
    };

    // Para POST/PATCH: leer el body crudo y reenviarlo con su Content-Type original
    // Esto soporta tanto application/json como multipart/form-data
    if (['POST', 'PATCH'].includes(req.method)) {
      const rawBody = await collectBody(req);
      if (rawBody.length > 0) {
        const ct = req.headers['content-type'] || '';
        opts.headers['Content-Type'] = ct;
        opts.body = rawBody;
      }
    }

    const upstream = await fetch(url, opts);
    if (upstream.status === 204) { res.status(204).end(); return; }
    const text = await upstream.text();

    // Log temporal para diagnosticar Time Tracking
    if (path.includes('time-tracking')) {
      console.log('[TT] →', req.method, path, '| body:', opts.body ? opts.body.toString().substring(0, 300) : 'none');
      console.log('[TT] ←', upstream.status, text.substring(0, 300));
    }

    res.status(upstream.status)
       .setHeader('Content-Type', 'application/json')
       .end(text);
  } catch (err) {
    res.status(502).json({ error: 'Error conectando con Humand', detail: err.message });
  }
}
