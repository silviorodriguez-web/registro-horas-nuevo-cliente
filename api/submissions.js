// api/submissions.js — Submissions en Postgres (Neon)
//
// GET    /api/submissions         → lista todas las submissions (?employeeId=... filtra por colaborador)
// POST   /api/submissions         → crea una submission nueva
// PATCH  /api/submissions?id=... → actualiza una submission (aprobar, editar)
// DELETE /api/submissions?id=... → elimina una submission

import { getPool } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const pool = getPool();

  try {
    if (req.method === 'GET') {
      // Con ?employeeId= el filtro se hace en SQL: así no se transfiere toda
      // la tabla desde Neon en cada consulta de un colaborador.
      const employeeId = req.query.employeeId;
      if (employeeId) {
        const { rows } = await pool.query(
          `SELECT data FROM submissions WHERE data->>'employeeId' = $1 ORDER BY id DESC`,
          [String(employeeId)]
        );
        return res.status(200).json(rows.map(r => r.data));
      }

      // Firma del contenido de toda la tabla, calculada dentro de Neon: el
      // panel de admin la consulta antes de bajar la tabla completa y solo la
      // descarga si la firma cambió (ver recargar() en admin.html).
      const VERSION_SQL = `md5(coalesce(string_agg(id::text || md5(data::text), ',' ORDER BY id), ''))`;
      if (req.query.version) {
        const { rows } = await pool.query(`SELECT ${VERSION_SQL} AS v FROM submissions`);
        return res.status(200).json({ version: rows[0].v });
      }

      // Un solo statement: la firma y los datos salen del mismo snapshot, así
      // el admin nunca guarda una firma más nueva que los datos que recibió.
      const { rows } = await pool.query(
        `SELECT coalesce(json_agg(data ORDER BY id DESC), '[]'::json) AS list, ${VERSION_SQL} AS v FROM submissions`
      );
      res.setHeader('X-Data-Version', rows[0].v);
      return res.status(200).json(rows[0].list);
    }

    if (req.method === 'POST') {
      if (!req.body?.id) return res.status(400).json({ error: 'Body inválido: falta id' });
      await pool.query(
        `INSERT INTO submissions (id, data) VALUES ($1,$2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [req.body.id, JSON.stringify(req.body)]
      );
      return res.status(201).json(req.body);
    }

    if (req.method === 'PATCH') {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'Falta parámetro id' });
      const { rows } = await pool.query('SELECT data FROM submissions WHERE id = $1', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Submission no encontrada' });
      const updated = { ...rows[0].data, ...req.body };
      await pool.query('UPDATE submissions SET data = $2 WHERE id = $1', [id, JSON.stringify(updated)]);
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'Falta parámetro id' });
      const { rowCount } = await pool.query('DELETE FROM submissions WHERE id = $1', [id]);
      if (!rowCount) return res.status(404).json({ error: 'Submission no encontrada' });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('[submissions]', err.message);
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  }
}
