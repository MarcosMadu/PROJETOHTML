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
  const m = auditoria?.maturidade;
  return m === 0 || m ? m : "—";
}

function getMaturidadeColor(maturidade) {
  const n = Number(maturidade);
  if (n === 4) return "#15803d";
  if (n === 3) return "#1d4ed8";
  if (n === 2) return "#b45309";
  return "#b91c1c";
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));

  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function collectDeviations(auditoria) {
  const itens = Array.isArray(auditoria?.itens) ? auditoria.itens : [];
  const out = [];

  for (const it of itens) {
    if (it?.status !== "NC") continue;

    const desvios = Array.isArray(it?.desvios) ? it.desvios : [];
    for (const d of desvios) {
      out.push({
        itemId: it.itemId ?? "",
        texto: it.texto ?? "",
        grupo: it.grupo ?? "",
        responsavel: d?.responsavel ?? d?.responsavelDesvio ?? "",
        descricao: d?.descricao ?? d?.texto ?? d?.observacao ?? "",
      });
    }
  }

  return out;
}

function buildAuditoriaEmailHtml(auditoria) {
  const maturidade = getMaturidade(auditoria);
  const maturidadeColor = getMaturidadeColor(maturidade);

  const local = auditoria?.area || auditoria?.local || "—";
  const semanaId = auditoria?.semanaId || "—";
  const dataHora = auditoria?.dataHora || "—";
  const tipoAuditoria = auditoria?.tipoAuditoria || "—";
  const setor = auditoria?.setor || "—";

  const auditorProgramado =
    auditoria?.auditorProgramado ||
    auditoria?.auditorAuto ||
    auditoria?.auditorSemanaAuto ||
    "—";

  const auditorRealizador =
    auditoria?.auditorRealizador ||
    auditoria?.auditorSemana ||
    auditoria?.auditor ||
    "—";

  const itens = Array.isArray(auditoria?.itens) ? auditoria.itens : [];
  const totalItens = itens.length;
  const totalC = itens.filter((it) => it?.status === "C").length;
  const totalNC = itens.filter((it) => it?.status === "NC").length;
  const totalNA = itens.filter((it) => it?.status === "NA").length;

  const desvios = collectDeviations(auditoria);

  const cardsDesvios = desvios.length
    ? desvios
        .map(
          (d, i) => `
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px;border:1px solid #d0d5dd;">
            <tr>
              <td style="padding:14px;background:#f9fafb;">
                <div style="font-size:12px;color:#475467;margin-bottom:6px;">NC ${escapeHtml(String(i + 1))}</div>
                <div style="font-size:15px;font-weight:bold;color:#101828;margin-bottom:10px;">
                  ${escapeHtml(d.texto || "Desvio não informado")}
                </div>

                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
                  <tr>
                    <td style="padding:5px 0;color:#475467;width:140px;">Item</td>
                    <td style="padding:5px 0;color:#101828;font-weight:bold;">${escapeHtml(d.itemId || "—")}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#475467;">Grupo</td>
                    <td style="padding:5px 0;color:#101828;font-weight:bold;">${escapeHtml(d.grupo || "—")}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#475467;">Responsável</td>
                    <td style="padding:5px 0;color:#101828;font-weight:bold;">${escapeHtml(d.responsavel || "—")}</td>
                  </tr>
                  ${
                    d.descricao
                      ? `
                      <tr>
                        <td style="padding:5px 0;color:#475467;vertical-align:top;">Observação</td>
                        <td style="padding:5px 0;color:#101828;">${escapeHtml(d.descricao)}</td>
                      </tr>
                    `
                      : ""
                  }
                </table>
              </td>
            </tr>
          </table>
        `
        )
        .join("")
    : `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #86efac;">
        <tr>
          <td style="padding:14px;background:#f0fdf4;color:#166534;font-size:14px;font-weight:bold;">
            Nenhuma não conformidade foi registrada nesta auditoria.
          </td>
        </tr>
      </table>
    `;

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Auditoria 5S</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#101828;">

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;border-collapse:collapse;">
      <tr>
        <td align="center">

          <table width="920" cellpadding="0" cellspacing="0" style="max-width:920px;width:96%;border-collapse:collapse;background:#ffffff;border:1px solid #d0d5dd;">

            <tr>
              <td style="background:#0f172a;padding:26px 24px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#dbeafe;margin-bottom:8px;">
                  Painel SESMT
                </div>
                <div style="font-size:28px;font-weight:bold;line-height:1.2;color:#ffffff;">
                  Nova Inspeção 5S Registrada
                </div>
                <div style="font-size:14px;color:#e0e7ff;margin-top:10px;">
                  Uma nova inspeção foi cadastrada automaticamente no sistema de gestão 5S.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;background:#ffffff;">

                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:22px;">
                  <tr>
                    <td width="25%" style="padding:10px;border:1px solid #d0d5dd;background:#f8fafc;">
                      <div style="font-size:12px;color:#475467;">Semana</div>
                      <div style="font-size:16px;font-weight:bold;color:#101828;">${escapeHtml(semanaId)}</div>
                    </td>
                    <td width="25%" style="padding:10px;border:1px solid #d0d5dd;background:#f8fafc;">
                      <div style="font-size:12px;color:#475467;">Local</div>
                      <div style="font-size:16px;font-weight:bold;color:#101828;">${escapeHtml(local)}</div>
                    </td>
                    <td width="25%" style="padding:10px;border:1px solid #d0d5dd;background:#f8fafc;">
                      <div style="font-size:12px;color:#475467;">Tipo de inspeção</div>
                      <div style="font-size:16px;font-weight:bold;color:#101828;">${escapeHtml(tipoAuditoria)}</div>
                    </td>
                    <td width="25%" style="padding:10px;border:1px solid #d0d5dd;background:#f8fafc;">
                      <div style="font-size:12px;color:#475467;">Maturidade</div>
                      <div style="font-size:18px;font-weight:bold;color:${maturidadeColor};">Nível ${escapeHtml(String(maturidade))}</div>
                    </td>
                  </tr>
                </table>

                <div style="font-size:20px;font-weight:bold;color:#101828;margin-bottom:12px;">
                  Informações da Inspeção
                </div>

                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;border:1px solid #d0d5dd;font-size:13px;">
                  <tr>
                    <td style="padding:12px 14px;border-bottom:1px solid #d0d5dd;color:#475467;background:#f8fafc;width:220px;">Data/Hora</td>
                    <td style="padding:12px 14px;border-bottom:1px solid #d0d5dd;color:#101828;font-weight:bold;">${escapeHtml(formatDateTime(dataHora))}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;border-bottom:1px solid #d0d5dd;color:#475467;background:#f8fafc;">Setor</td>
                    <td style="padding:12px 14px;border-bottom:1px solid #d0d5dd;color:#101828;font-weight:bold;">${escapeHtml(setor)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;border-bottom:1px solid #d0d5dd;color:#475467;background:#f8fafc;">Auditor programado</td>
                    <td style="padding:12px 14px;border-bottom:1px solid #d0d5dd;color:#101828;font-weight:bold;">${escapeHtml(auditorProgramado)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;color:#475467;background:#f8fafc;">Auditor realizador</td>
                    <td style="padding:12px 14px;color:#101828;font-weight:bold;">${escapeHtml(auditorRealizador)}</td>
                  </tr>
                </table>

                <div style="font-size:20px;font-weight:bold;color:#101828;margin-bottom:12px;">
                  Resumo da Inspeção
                </div>

                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                  <tr>
                    <td width="25%" style="padding:12px;border:1px solid #d0d5dd;background:#ffffff;">
                      <div style="font-size:12px;color:#475467;">Itens avaliados</div>
                      <div style="font-size:26px;font-weight:bold;color:#101828;">${escapeHtml(String(totalItens))}</div>
                    </td>
                    <td width="25%" style="padding:12px;border:1px solid #bbf7d0;background:#f0fdf4;">
                      <div style="font-size:12px;color:#166534;">Conformes</div>
                      <div style="font-size:26px;font-weight:bold;color:#166534;">${escapeHtml(String(totalC))}</div>
                    </td>
                    <td width="25%" style="padding:12px;border:1px solid #fecaca;background:#fef2f2;">
                      <div style="font-size:12px;color:#991b1b;">Não conformes</div>
                      <div style="font-size:26px;font-weight:bold;color:#991b1b;">${escapeHtml(String(totalNC))}</div>
                    </td>
                    <td width="25%" style="padding:12px;border:1px solid #fde68a;background:#fffbeb;">
                      <div style="font-size:12px;color:#92400e;">Não aplicáveis</div>
                      <div style="font-size:26px;font-weight:bold;color:#92400e;">${escapeHtml(String(totalNA))}</div>
                    </td>
                  </tr>
                </table>

                <div style="font-size:20px;font-weight:bold;color:#101828;margin-bottom:12px;">
                  Não Conformidades Identificadas
                </div>

                ${cardsDesvios}

                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:24px;border-top:1px solid #d0d5dd;">
                  <tr>
                    <td style="padding-top:16px;font-size:13px;color:#475467;line-height:1.6;">
                      Esta mensagem foi enviada automaticamente pelo <strong>Painel SESMT</strong> após o registro de uma nova inspeção 5S.
                      <br>
                      <span style="font-size:12px;color:#667085;">
                        Gestão de Segurança do Trabalho • Sistema interno de inspeções e indicadores 5S
                      </span>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
}

async function sendAuditoriaCreatedEmail(auditoria) {
  const toList = (process.env.AUDITORIA_EMAIL_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!toList.length) return;

  const transporter = makeTransporter();

  const semanaId = auditoria?.semanaId || "—";
  const local = auditoria?.area || auditoria?.local || "—";
  const maturidade = getMaturidade(auditoria);

  const subject = `Inspeção 5S — Semana ${semanaId} — ${local} — Maturidade ${maturidade}`;

  const html = buildAuditoriaEmailHtml(auditoria);

  await transporter.sendMail({
    from: process.env.AUDITORIA_EMAIL_FROM || process.env.SMTP_USER,
    to: toList,
    subject,
    html,
  });
}

module.exports = { sendAuditoriaCreatedEmail };
