// api/legajos.js — Mapeo email de Humand -> legajo de nómina (para export PF)
//
// GET    /api/legajos            -> { "email@dominio.com": "12345", ... }
// POST   /api/legajos            -> body: { "email@dominio.com": "12345", ... } (merge)
// DELETE /api/legajos?email=...  -> elimina una entrada

import { put, list } from '@vercel/blob';

const BLOB_KEY = 'horas-legajos.json';

async function readLegajos() {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    if (!blobs.length) return {};
    const res = await fetch(blobs[0].url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

async function writeLegajos(map) {
  await put(BLOB_KEY, JSON.stringify(map), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'GET') {
      const map = await readLegajos();
      return res.status(200).json(map);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ error: 'Body inválido: se espera un objeto {email: legajo}' });
      }
      const current = await readLegajos();
      Object.keys(body).forEach(email => {
        const key = String(email).trim().toLowerCase();
        const legajo = String(body[email]).trim();
        if (key && legajo) current[key] = legajo;
      });
      await writeLegajos(current);
      return res.status(200).json(current);
    }

    if (req.method === 'DELETE') {
      const email = (req.query.email || '').toLowerCase();
      if (!email) return res.status(400).json({ error: 'Falta parámetro email' });
      const current = await readLegajos();
      delete current[email];
      await writeLegajos(current);
      return res.status(200).json(current);
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('[legajos]', err.message);
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  }
}
