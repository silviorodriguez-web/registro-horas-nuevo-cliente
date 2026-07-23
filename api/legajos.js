// api/legajos.js — Mapeo email de Humand -> legajo de nómina (Postgres/Neon)
//
// GET    /api/legajos            -> { "email@dominio.com": "12345", ... }
// POST   /api/legajos            -> body: { "email@dominio.com": "12345", ... } (merge)
// DELETE /api/legajos?email=...  -> elimina una entrada

import { getPool } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const pool = getPool();

  try {
    if (req.method === 'GET') {
      const { rows } = await pool.query('SELECT email, legajo FROM legajos');
      const map = {};
      rows.forEach(r => { map[r.email] = r.legajo; });
      return res.status(200).json(map);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ error: 'Body inválido: se espera un objeto {email: legajo}' });
      }
      for (const [rawEmail, rawLegajo] of Object.entries(body)) {
        const email = String(rawEmail).trim().toLowerCase();
        const legajo = String(rawLegajo).trim();
        if (email && legajo) {
          await pool.query(
            `INSERT INTO legajos (email, legajo) VALUES ($1,$2)
             ON CONFLICT (email) DO UPDATE SET legajo = EXCLUDED.legajo`,
            [email, legajo]
          );
        }
      }
      const { rows } = await pool.query('SELECT email, legajo FROM legajos');
      const map = {};
      rows.forEach(r => { map[r.email] = r.legajo; });
      return res.status(200).json(map);
    }

    if (req.method === 'DELETE') {
      const email = (req.query.email || '').toLowerCase();
      if (!email) return res.status(400).json({ error: 'Falta parámetro email' });
      await pool.query('DELETE FROM legajos WHERE email = $1', [email]);
      const { rows } = await pool.query('SELECT email, legajo FROM legajos');
      const map = {};
      rows.forEach(r => { map[r.email] = r.legajo; });
      return res.status(200).json(map);
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('[legajos]', err.message);
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  }
}
