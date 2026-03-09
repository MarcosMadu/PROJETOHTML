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

function getMaturidadeColor(maturidade) {
  const n = Number(maturidade);
  if (n === 4) return "#16a34a";
  if (n === 3) return "#2563eb";
  if (n === 2) return "#f59e0b";
  return "#dc2626";
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

  // Auditor programado (automatico da semana) vs realizador (fixado no registro)
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
  const totalC = itens.filter(it => it?.status === "C").length;
  const totalNC = itens.filter(it => it?.status === "NC").length;
  const totalNA = itens.filter(it => it?.status === "NA").length;

  const desvios = collectDeviations(auditoria);
  const hasDesvios = desvios.length > 0;

  const cardsDesvios = hasDesvios
    ? desvios.map((d, i) => `
      <div style="border:1px solid #e4e7ec;border-radius:14px;padding:14px 16px;background:#f9fafb;margin-bottom:12px">
        <div style="font-size:12px;color:#667085;margin-bottom:6px">NC ${escapeHtml(String(i + 1))}</div>
        <div style="font-size:15px;font-weight:800;color:#101828;margin-bottom:8px">
          ${escapeHtml(d.texto || "Desvio não informado")}
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr>
            <td style="padding:4px 0;color:#667085;width:140px">Item</td>
            <td style="padding:4px 0;color:#101828"><strong>${escapeHtml(d.itemId || "—")}</strong></td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#667085">Grupo</td>
            <td style="padding:4px 0;color:#101828"><strong>${escapeHtml(d.grupo || "—")}</strong></td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#667085">Responsável</td>
            <td style="padding:4px 0;color:#101828"><strong>${escapeHtml(d.responsavel || "—")}</strong></td>
          </tr>
          ${
            d.descricao
              ? `
              <tr>
                <td style="padding:4px 0;color:#667085;vertical-align:top">Observação</td>
                <td style="padding:4px 0;color:#101828">${escapeHtml(d.descricao)}</td>
              </tr>
            `
              : ""
          }
        </table>
      </div>
    `).join("")
    : `
      <div style="border:1px solid #d1fae5;background:#ecfdf5;color:#065f46;border-radius:14px;padding:14px 16px">
        Nenhuma não conformidade foi registrada nesta auditoria.
      </div>
    `;

  return `
  <div style="margin:0;padding:24px 12px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#101828">
    <div style="max-width:920px;margin:0 auto">

      <div style="background:linear-gradient(135deg,#0f172a,#1d4ed8);border-radius:20px 20px 0 0;padding:28px 24px;color:#ffffff">
        <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.85;margin-bottom:8px">
          Painel SESMT
        </div>
        <div style="font-size:28px;font-weight:800;line-height:1.2">
          Nova Auditoria 5S Registrada
        </div>
        <div style="font-size:14px;opacity:.92;margin-top:10px">
          Uma nova auditoria foi cadastrada automaticamente no sistema de gestão 5S.
        </div>
      </div>

      <div style="background:#ffffff;border:1px solid #e4e7ec;border-top:none;border-radius:0 0 20px 20px;padding:24px;box-shadow:0 10px 30px rgba(15,23,42,.08)">

        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:22px">
          <div style="flex:1 1 180px;min-width:180px;background:#f8fafc;border:1px solid #e4e7ec;border-radius:14px;padding:14px">
            <div style="font-size:12px;color:#667085;margin-bottom:6px">Semana</div>
            <div style="font-size:16px;font-weight:800;color:#101828">${escapeHtml(semanaId)}</div>
          </div>

          <div style="flex:1 1 180px;min-width:180px;background:#f8fafc;border:1px solid #e4e7ec;border-radius:14px;padding:14px">
            <div style="font-size:12px;color:#667085;margin-bottom:6px">Local</div>
            <div style="font-size:16px;font-weight:800;color:#101828">${escapeHtml(local)}</div>
          </div>

          <div style="flex:1 1 180px;min-width:180px;background:#f8fafc;border:1px solid #e4e7ec;border-radius:14px;padding:14px">
            <div style="font-size:12px;color:#667085;margin-bottom:6px">Tipo de auditoria</div>
            <div style="font-size:16px;font-weight:800;color:#101828">${escapeHtml(tipoAuditoria)}</div>
          </div>

          <div style="flex:1 1 180px;min-width:180px;background:${maturidadeColor}12;border:1px solid ${maturidadeColor}33;border-radius:14px;padding:14px">
            <div style="font-size:12px;color:#667085;margin-bottom:6px">Maturidade</div>
            <div style="font-size:18px;font-weight:800;color:${maturidadeColor}">
              Nível ${escapeHtml(String(maturidade))}
            </div>
          </div>
        </div>

        <div style="margin-bottom:24px">
          <div style="font-size:18px;font-weight:800;color:#101828;margin-bottom:12px">
            Informações da Auditoria
          </div>

          <div style="border:1px solid #e4e7ec;border-radius:16px;overflow:hidden">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e7ec;color:#667085;width:220px;background:#fbfcfe">Data/Hora</td>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e7ec"><strong>${escapeHtml(formatDateTime(dataHora))}</strong></td>
              </tr>
              <tr>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e7ec;color:#667085;background:#fbfcfe">Setor</td>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e7ec"><strong>${escapeHtml(setor)}</strong></td>
              </tr>
              <tr>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e7ec;color:#667085;background:#fbfcfe">Auditor programado</td>
                <td style="padding:12px 14px;border-bottom:1px solid #e4e7ec"><strong>${escapeHtml(auditorProgramado)}</strong></td>
              </tr>
              <tr>
                <td style="padding:12px 14px;color:#667085;background:#fbfcfe">Auditor realizador</td>
                <td style="padding:12px 14px"><strong>${escapeHtml(auditorRealizador)}</strong></td>
              </tr>
            </table>
          </div>
        </div>

        <div style="margin-bottom:24px">
          <div style="font-size:18px;font-weight:800;color:#101828;margin-bottom:12px">
            Resumo da Auditoria
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:12px">
            <div style="flex:1 1 150px;min-width:150px;border:1px solid #e4e7ec;border-radius:14px;padding:14px;background:#ffffff">
              <div style="font-size:12px;color:#667085">Itens avaliados</div>
              <div style="font-size:24px;font-weight:800;color:#101828">${escapeHtml(String(totalItens))}</div>
            </div>

            <div style="flex:1 1 150px;min-width:150px;border:1px solid #dcfce7;border-radius:14px;padding:14px;background:#f0fdf4">
              <div style="font-size:12px;color:#166534">Conformes</div>
              <div style="font-size:24px;font-weight:800;color:#166534">${escapeHtml(String(totalC))}</div>
            </div>

            <div style="flex:1 1 150px;min-width:150px;border:1px solid #fee2e2;border-radius:14px;padding:14px;background:#fef2f2">
              <div style="font-size:12px;color:#991b1b">Não conformes</div>
              <div style="font-size:24px;font-weight:800;color:#991b1b">${escapeHtml(String(totalNC))}</div>
            </div>

            <div style="flex:1 1 150px;min-width:150px;border:1px solid #fef3c7;border-radius:14px;padding:14px;background:#fffbeb">
              <div style="font-size:12px;color:#92400e">Não aplicáveis</div>
              <div style="font-size:24px;font-weight:800;color:#92400e">${escapeHtml(String(totalNA))}</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom:20px">
          <div style="font-size:18px;font-weight:800;color:#101828;margin-bottom:12px">
            Não Conformidades Identificadas
          </div>
          ${cardsDesvios}
        </div>

        <div style="border-top:1px solid #e4e7ec;padding-top:16px;margin-top:24px">
          <div style="font-size:13px;color:#475467;line-height:1.6">
            Esta mensagem foi enviada automaticamente pelo <strong>Painel SESMT</strong> após o registro de uma nova auditoria 5S.
          </div>
          <div style="font-size:12px;color:#667085;margin-top:6px">
            Gestão de Segurança do Trabalho • Sistema interno de auditorias e inspeções
          </div>
        </div>

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
