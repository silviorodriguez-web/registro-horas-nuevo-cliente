// api/projects.js — Gestión de proyectos para whitelist y panel de administración (Postgres/Neon)
//
// GET    /api/projects                        → lista todos los proyectos
// GET    /api/projects?employeeId=123         → proyectos donde el empleado está autorizado
// POST   /api/projects                        → crea proyecto
// PATCH  /api/projects?id=N                  → actualiza proyecto
// DELETE /api/projects?id=N                  → elimina proyecto

import { getPool } from './_db.js';

function toApi(row) {
  return {
    id: Number(row.id),
    name: row.name,
    client: row.client || '',
    clientCode: row.client_code || '',
    division: row.division || '',
    contractType: row.contract_type || '',
    billable: row.billable,
    status: row.status,
    closeDate: row.close_date ? row.close_date.toISOString().slice(0, 10) : null,
    employees: row.employees || [],
    employeeEmails: row.employee_emails || [],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const pool = getPool();

  try {
    const url    = new URL(req.url, 'http://localhost');
    const numId  = url.searchParams.get('id')         ? Number(url.searchParams.get('id'))         : null;
    const empId  = url.searchParams.get('employeeId') ? Number(url.searchParams.get('employeeId')) : null;

    if (req.method === 'GET') {
      // Auto-cerrar proyectos con fecha vencida
      await pool.query(`UPDATE projects SET status = 'closed' WHERE status = 'active' AND close_date IS NOT NULL AND close_date < CURRENT_DATE`);

      const { rows } = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
      let projects = rows.map(toApi);

      if (empId !== null) {
        projects = projects.filter(p =>
          p.status === 'active' &&
          (!p.employees || p.employees.length === 0 || p.employees.includes(empId))
        );
      }
      return res.status(200).json(projects);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body.name) return res.status(400).json({ error: 'Falta el nombre del proyecto' });

      const id = Number(body.id) || Date.now();
      const existing = await pool.query('SELECT 1 FROM projects WHERE id = $1', [id]);
      if (body.id && existing.rowCount > 0) {
        return res.status(409).json({ error: 'Ya existe un proyecto con ese ID' });
      }

      const { rows } = await pool.query(
        `INSERT INTO projects (id, name, client, client_code, division, contract_type, billable, status, close_date, employees, employee_emails, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,now())
         RETURNING *`,
        [
          id,
          body.name.trim(),
          (body.client || '').trim(),
          (body.clientCode || '').trim(),
          (body.division || '').trim(),
          (body.contractType || '').trim(),
          body.billable !== false,
          body.closeDate || null,
          JSON.stringify(Array.isArray(body.employees) ? body.employees.map(Number) : []),
          JSON.stringify(Array.isArray(body.employeeEmails) ? body.employeeEmails : []),
        ]
      );
      return res.status(201).json(toApi(rows[0]));
    }

    if (req.method === 'PATCH') {
      if (numId === null) return res.status(400).json({ error: 'Falta parámetro id' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const { rows: existingRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [numId]);
      if (!existingRows.length) return res.status(404).json({ error: 'Proyecto no encontrado' });
      const existing = toApi(existingRows[0]);
      const merged = { ...existing, ...body, id: existing.id };
      if (body.employees) merged.employees = Array.isArray(body.employees) ? body.employees.map(Number) : [];

      const { rows } = await pool.query(
        `UPDATE projects SET
           name=$2, client=$3, client_code=$4, division=$5, contract_type=$6,
           billable=$7, status=$8, close_date=$9, employees=$10, employee_emails=$11
         WHERE id=$1
         RETURNING *`,
        [
          numId,
          merged.name,
          merged.client || '',
          merged.clientCode || '',
          merged.division || '',
          merged.contractType || '',
          merged.billable !== false,
          merged.status || 'active',
          merged.closeDate || null,
          JSON.stringify(merged.employees || []),
          JSON.stringify(merged.employeeEmails || []),
        ]
      );
      return res.status(200).json(toApi(rows[0]));
    }

    if (req.method === 'DELETE') {
      if (numId === null) return res.status(400).json({ error: 'Falta parámetro id' });
      await pool.query('DELETE FROM projects WHERE id = $1', [numId]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('[projects]', err.message);
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  }
}
