const nodemailer = require("nodemailer");

function makeTransporter() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getMaturidade(auditoria) {
  // Preferir o que já vem calculado/salvo
  const m = auditoria?.maturidade;
  return (m === 0 || m) ? m : "—";
}

function collectDeviations(auditoria) {
  // Retorna lista plana: [{ itemId, texto, responsavel, descricao }]
  const itens = Array.isArray(auditoria?.itens) ? auditoria.itens : [];
  const out = [];

  for (const it of itens) {
    if (it?.status !== "NC") continue;

    const desvios = Array.isArray(it?.desvios) ? it.desvios : [];
    for (const d of desvios) {
      out.push({
        itemId: it.itemId ?? "",
        texto: it.texto ?? "",
        responsavel: d?.responsavel ?? d?.responsavelDesvio ?? "",
        descricao: d?.descricao ?? d?.texto ?? d?.observacao ?? "",
      });
    }
  }
  return out;
}

function buildAuditoriaEmailHtml(auditoria) {
  const maturidade = getMaturidade(auditoria);
  const local = auditoria?.area || auditoria?.local || "—";
  const semanaId = auditoria?.semanaId || "—";
  const dataHora = auditoria?.dataHora || "—";

  // Auditor programado (automatico da semana) vs realizador (fixado no registro)
  const auditorProgramado = auditoria?.auditorProgramado || auditoria?.auditorAuto || auditoria?.auditorSemanaAuto || "—";
  const auditorRealizador = auditoria?.auditorSemana || auditoria?.auditor || "—";

  const desvios = collectDeviations(auditoria);

  const hasDesvios = desvios.length > 0;

  const rows = hasDesvios
    ? desvios.map((d, i) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e4e7ec;">${escapeHtml(String(i + 1))}</td>
        <td style="padding:10px;border-bottom:1px solid #e4e7ec;"><strong>${escapeHtml(d.itemId)}</strong></td>
        <td style="padding:10px;border-bottom:1px solid #e4e7ec;">${escapeHtml(d.texto)}</td>
        <td style="padding:10px;border-bottom:1px solid #e4e7ec;"><strong>${escapeHtml(d.responsavel || "—")}</strong></td>
      </tr>
    `).join("")
    : "";

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#101828;background:#f2f4f7;padding:18px">
    <div style="max-width:920px;margin:0 auto;background:#ffffff;border:1px solid #e4e7ec;border-radius:14px;overflow:hidden">
      <div style="padding:16px 18px;border-bottom:1px solid #e4e7ec;background:#fbfcfe">
        <div style="font-size:14px;color:#667085">Gestão 5S Tecnosonda</div>
        <div style="font-size:18px;font-weight:800;margin-top:6px">Auditoria 5S — Resumo do Registro</div>
        <div style="font-size:12px;color:#667085;margin-top:6px">
          Semana: <strong>${escapeHtml(semanaId)}</strong> · Data/Hora: <strong>${escapeHtml(dataHora)}</strong>
        </div>
      </div>

      <div style="padding:16px 18px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e4e7ec;color:#667085;width:220px">Maturidade alcançada</td>
            <td style="padding:10px;border-bottom:1px solid #e4e7ec"><strong>${escapeHtml(String(maturidade))}</strong></td>
          </tr>
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e4e7ec;color:#667085">Local</td>
            <td style="padding:10px;border-bottom:1px solid #e4e7ec"><strong>${escapeHtml(local)}</strong></td>
          </tr>
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e4e7ec;color:#667085">Auditor programado</td>
            <td style="padding:10px;border-bottom:1px solid #e4e7ec"><strong>${escapeHtml(auditorProgramado)}</strong></td>
          </tr>
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e4e7ec;color:#667085">Auditor realizador</td>
            <td style="padding:10px;border-bottom:1px solid #e4e7ec"><strong>${escapeHtml(auditorRealizador)}</strong></td>
          </tr>
        </table>

        <div style="margin-top:14px;font-size:14px;font-weight:800">Itens com desvios e responsáveis</div>
        ${
          hasDesvios
            ? `
              <div style="margin-top:8px;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                  <thead>
                    <tr style="background:#fbfcfe;color:#667085;font-size:12px">
                      <th style="text-align:left;padding:10px;border-bottom:1px solid #e4e7ec;width:40px">#</th>
                      <th style="text-align:left;padding:10px;border-bottom:1px solid #e4e7ec;width:70px">Item</th>
                      <th style="text-align:left;padding:10px;border-bottom:1px solid #e4e7ec">Desvio</th>
                      <th style="text-align:left;padding:10px;border-bottom:1px solid #e4e7ec;width:220px">Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows}
                  </tbody>
                </table>
              </div>
            `
            : `<div style="margin-top:8px;color:#667085">Nenhum desvio (NC) registrado nesta auditoria.</div>`
        }
      </div>

      <div style="padding:12px 18px;border-top:1px solid #e4e7ec;color:#667085;font-size:12px;background:#fbfcfe">
        Mensagem automática — sistema de auditoria 5S Tecnosonda.
      </div>
    </div>
  </div>
  `;
}

async function sendAuditoriaCreatedEmail(auditoria) {
  const toList = (process.env.AUDITORIA_EMAIL_TO || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (!toList.length) return; // não quebra o fluxo se não tiver destinatário

  const transporter = makeTransporter();

  const semanaId = auditoria?.semanaId || "—";
  const local = auditoria?.area || auditoria?.local || "—";
  const maturidade = getMaturidade(auditoria);
  const subject = `Auditoria 5S — Semana ${semanaId} — ${local} — Maturidade ${maturidade}`;

  const html = buildAuditoriaEmailHtml(auditoria);

  await transporter.sendMail({
    from: process.env.AUDITORIA_EMAIL_FROM || process.env.SMTP_USER,
    to: toList,
    subject,
    html,
  });
}

module.exports = { sendAuditoriaCreatedEmail };
