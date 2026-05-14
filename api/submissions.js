// api/submissions.js — Un archivo Blob por submission (sin race conditions)
//
// GET    /api/submissions         → lista todas las submissions
// POST   /api/submissions         → crea una submission nueva
// PATCH  /api/submissions?id=... → actualiza una submission (aprobar, editar)
// DELETE /api/submissions?id=... → elimina una submission

import { put, list, del } from '@vercel/blob';

const PREFIX = 'horas-sub/';

function blobPath(id) {
  return `${PREFIX}${id}.json`;
}

async function readOne(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function readSubmissions() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  if (!blobs.length) return [];
  const results = await Promise.all(blobs.map(b => readOne(b.url)));
  return results
    .filter(Boolean)
    .sort((a, b) => b.id - a.id); // más reciente primero
}

async function writeOne(sub) {
  await put(blobPath(sub.id), JSON.stringify(sub), {
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
    if (req.method === 'GET') {
      const submissions = await readSubmissions();
      return res.status(200).json(submissions);
    }

    if (req.method === 'POST') {
      if (!req.body?.id) return res.status(400).json({ error: 'Body inválido: falta id' });
      await writeOne(req.body);
      return res.status(201).json(req.body);
    }

    if (req.method === 'PATCH') {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'Falta parámetro id' });
      const { blobs } = await list({ prefix: blobPath(id), limit: 1 });
      if (!blobs.length) return res.status(404).json({ error: 'Submission no encontrada' });
      const existing = await readOne(blobs[0].url);
      if (!existing) return res.status(404).json({ error: 'Submission no encontrada' });
      const updated = { ...existing, ...req.body };
      await writeOne(updated);
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'Falta parámetro id' });
      const { blobs } = await list({ prefix: blobPath(id), limit: 1 });
      if (!blobs.length) return res.status(404).json({ error: 'Submission no encontrada' });
      await del(blobs[0].url);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('[submissions]', err.message);
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  }
}
