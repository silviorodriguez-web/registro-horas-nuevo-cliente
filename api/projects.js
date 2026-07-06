// api/projects.js — Gestión de proyectos para whitelist y panel de administración
//
// GET    /api/projects                        → lista todos los proyectos
// GET    /api/projects?employeeId=123         → proyectos donde el empleado está autorizado
// POST   /api/projects                        → crea proyecto
// PATCH  /api/projects?id=N                  → actualiza proyecto
// DELETE /api/projects?id=N                  → elimina proyecto

import { put, list } from '@vercel/blob';

const BLOB_KEY = 'horas-sub-cliente/projects.json';

async function readProjects() {
  try {
    const { blobs } = await list({ prefix: 'horas-sub-cliente/projects', limit: 1 });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function writeProjects(arr) {
  await put(BLOB_KEY, JSON.stringify(arr), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const url    = new URL(req.url, 'http://localhost');
    const numId  = url.searchParams.get('id')         ? Number(url.searchParams.get('id'))         : null;
    const empId  = url.searchParams.get('employeeId') ? Number(url.searchParams.get('employeeId')) : null;

    if (req.method === 'GET') {
      let projects = await readProjects();
      // Auto-cerrar proyectos con fecha vencida
      const today = new Date().toISOString().slice(0, 10);
      projects = projects.map(p =>
        p.status === 'active' && p.closeDate && today > p.closeDate
          ? { ...p, status: 'closed' }
          : p
      );
      // Si se filtra por empleado: solo activos donde está en la whitelist (o whitelist vacía = todos)
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
      const projects = await readProjects();
      // Verificar que el ID numérico no esté duplicado
      if (body.id && projects.find(p => p.id === Number(body.id))) {
        return res.status(409).json({ error: 'Ya existe un proyecto con ese ID' });
      }
      const proj = {
        id:        Number(body.id) || Date.now(),
        name:      body.name.trim(),
        client:    (body.client || '').trim(),
        clientCode:   (body.clientCode || '').trim(),
        division:     (body.division || '').trim(),
        contractType: (body.contractType || '').trim(),
        billable:  body.billable !== false,
        status:    'active',
        closeDate: body.closeDate || null,
        employees: Array.isArray(body.employees) ? body.employees.map(Number) : [],
        employeeEmails: Array.isArray(body.employeeEmails) ? body.employeeEmails : [],
        createdAt: new Date().toISOString(),
      };
      projects.push(proj);
      await writeProjects(projects);
      return res.status(201).json(proj);
    }

    if (req.method === 'PATCH') {
      if (numId === null) return res.status(400).json({ error: 'Falta parámetro id' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const projects = await readProjects();
      const idx = projects.findIndex(p => p.id === numId);
      if (idx < 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
      const updated = { ...projects[idx], ...body, id: projects[idx].id };
      if (body.employees) updated.employees = Array.isArray(body.employees) ? body.employees.map(Number) : [];
      projects[idx] = updated;
      await writeProjects(projects);
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      if (numId === null) return res.status(400).json({ error: 'Falta parámetro id' });
      const projects = await readProjects();
      const filtered = projects.filter(p => p.id !== numId);
      await writeProjects(filtered);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('[projects]', err.message);
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  }
}
