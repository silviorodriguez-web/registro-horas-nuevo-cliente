export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[notify] RESEND_API_KEY no configurada — email omitido');
    res.status(200).json({ skipped: true });
    return;
  }

  const { to, employeeName, supervisorName, periodo, comment } = req.body || {};
  if (!to) { res.status(400).json({ error: 'Falta campo to' }); return; }

  const observacion = comment
    ? `<p style="margin:0 0 12px"><strong>Observación:</strong> ${comment}</p>`
    : '';

  const html = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1B2E">
      <div style="background:#1E3A8A;padding:20px 24px;border-radius:10px 10px 0 0">
        <span style="color:#fff;font-size:16px;font-weight:600">Humand · Registro de Horas</span>
      </div>
      <div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-top:none;border-radius:0 0 10px 10px;padding:28px 24px">
        <p style="margin:0 0 16px;font-size:15px">Hola <strong>${employeeName}</strong>,</p>
        <p style="margin:0 0 12px">Tu registro de horas del período <strong>${periodo}</strong> fue eliminado por <strong>${supervisorName}</strong>.</p>
        ${observacion}
        <p style="margin:0 0 24px">Por favor, volvé a cargar tus horas desde el sistema.</p>
        <a href="https://registro-horas-pied.vercel.app" style="background:#3B5FBF;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px">Cargar mis horas →</a>
        <p style="margin:24px 0 0;font-size:11px;color:#6B7280">Este es un mensaje automático. No respondas este email.</p>
      </div>
    </div>
  `;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Humand Horas <noreply@humand.co>',
        to,
        subject: `Tu registro de horas fue eliminado — ${periodo}`,
        html,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(err);
    }
    res.status(200).json({ sent: true });
  } catch (err) {
    console.error('[notify] Error enviando email:', err.message);
    res.status(500).json({ error: err.message });
  }
}
