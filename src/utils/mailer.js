const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function getMaturidadeColor(maturidade) {
  if (Number(maturidade) === 4) return "#16a34a";
  if (Number(maturidade) === 3) return "#2563eb";
  if (Number(maturidade) === 2) return "#f59e0b";
  return "#dc2626";
}

function formatarData(data) {
  if (!data) return "-";

  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function escapeHtml(texto = "") {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendAuditoriaCreatedEmail(doc) {
  try {
    const itens = Array.isArray(doc.itens) ? doc.itens : [];

    const itensNC = itens.filter((item) => item.status === "NC");
    const totalItens = itens.length;
    const totalNC = itensNC.length;
    const totalC = itens.filter((item) => item.status === "C").length;
    const totalNA = itens.filter((item) => item.status === "NA").length;

    let desviosHtml = "";

    if (itensNC.length > 0) {
      itensNC.forEach((item, index) => {
        const desvios = Array.isArray(item.desvios) ? item.desvios : [];

        const responsaveis = desvios.length
          ? desvios
              .map((d) => escapeHtml(d.responsavel || "Não informado"))
              .join(", ")
          : "Não informado";

        desviosHtml += `
          <div style="border:1px solid #e5e7eb; border-radius:12px; padding:14px; margin-bottom:12px; background:#f9fafb;">
            <div style="font-size:13px; color:#6b7280; margin-bottom:6px;">
              NC ${index + 1}
            </div>
            <div style="font-size:15px; font-weight:700; color:#111827; margin-bottom:8px;">
              ${escapeHtml(item.texto || "Item não informado")}
            </div>
            <div style="font-size:14px; color:#374151; margin-bottom:4px;">
              <strong>Grupo:</strong> ${escapeHtml(item.grupo || "-")}
            </div>
            <div style="font-size:14px; color:#374151;">
              <strong>Responsável(is):</strong> ${responsaveis}
            </div>
          </div>
        `;
      });
    } else {
      desviosHtml = `
        <div style="border:1px solid #d1fae5; background:#ecfdf5; color:#065f46; border-radius:12px; padding:14px;">
          Nenhuma não conformidade foi registrada nesta auditoria.
        </div>
      `;
    }

    const maturidadeColor = getMaturidadeColor(doc.maturidade);

    const html = `
      <div style="margin:0; padding:0; background:#f3f4f6; font-family:Arial, Helvetica, sans-serif;">
        <div style="max-width:760px; margin:0 auto; padding:24px 16px;">
          
          <div style="background:linear-gradient(135deg, #0f172a, #1d4ed8); border-radius:18px 18px 0 0; padding:28px 24px; color:#ffffff;">
            <div style="font-size:12px; letter-spacing:1px; text-transform:uppercase; opacity:.85; margin-bottom:8px;">
              Painel SESMT
            </div>
            <h1 style="margin:0; font-size:28px; line-height:1.2;">
              Nova Auditoria 5S Registrada
            </h1>
            <p style="margin:10px 0 0; font-size:14px; opacity:.92;">
              Uma nova auditoria foi cadastrada automaticamente no sistema.
            </p>
          </div>

          <div style="background:#ffffff; border-radius:0 0 18px 18px; padding:24px; box-shadow:0 10px 30px rgba(15,23,42,.08);">
            
            <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
              <div style="flex:1 1 180px; min-width:180px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px; padding:14px;">
                <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Semana</div>
                <div style="font-size:16px; font-weight:700; color:#111827;">${escapeHtml(doc.semanaId || "-")}</div>
              </div>

              <div style="flex:1 1 180px; min-width:180px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px; padding:14px;">
                <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Local</div>
                <div style="font-size:16px; font-weight:700; color:#111827;">${escapeHtml(doc.local || "-")}</div>
              </div>

              <div style="flex:1 1 180px; min-width:180px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px; padding:14px;">
                <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Tipo</div>
                <div style="font-size:16px; font-weight:700; color:#111827;">${escapeHtml(doc.tipoAuditoria || "-")}</div>
              </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:24px;">
              <div style="flex:1 1 180px; min-width:180px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px; padding:14px;">
                <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Auditor</div>
                <div style="font-size:16px; font-weight:700; color:#111827;">${escapeHtml(doc.auditorRealizador || doc.auditorSemana || "-")}</div>
              </div>

              <div style="flex:1 1 180px; min-width:180px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px; padding:14px;">
                <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Data da auditoria</div>
                <div style="font-size:16px; font-weight:700; color:#111827;">${formatarData(doc.dataHora)}</div>
              </div>

              <div style="flex:1 1 180px; min-width:180px; background:${maturidadeColor}10; border:1px solid ${maturidadeColor}33; border-radius:14px; padding:14px;">
                <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">Maturidade</div>
                <div style="font-size:18px; font-weight:800; color:${maturidadeColor};">Nível ${escapeHtml(String(doc.maturidade || "-"))}</div>
              </div>
            </div>

            <div style="margin-bottom:24px;">
              <h2 style="margin:0 0 14px; font-size:18px; color:#111827;">
                Resumo da Auditoria
              </h2>

              <div style="display:flex; flex-wrap:wrap; gap:12px;">
                <div style="flex:1 1 150px; min-width:150px; border:1px solid #e5e7eb; border-radius:14px; padding:14px; background:#ffffff;">
                  <div style="font-size:12px; color:#6b7280;">Itens avaliados</div>
                  <div style="font-size:24px; font-weight:800; color:#111827;">${totalItens}</div>
                </div>

                <div style="flex:1 1 150px; min-width:150px; border:1px solid #dcfce7; border-radius:14px; padding:14px; background:#f0fdf4;">
                  <div style="font-size:12px; color:#166534;">Conformes</div>
                  <div style="font-size:24px; font-weight:800; color:#166534;">${totalC}</div>
                </div>

                <div style="flex:1 1 150px; min-width:150px; border:1px solid #fee2e2; border-radius:14px; padding:14px; background:#fef2f2;">
                  <div style="font-size:12px; color:#991b1b;">Não conformes</div>
                  <div style="font-size:24px; font-weight:800; color:#991b1b;">${totalNC}</div>
                </div>

                <div style="flex:1 1 150px; min-width:150px; border:1px solid #fef3c7; border-radius:14px; padding:14px; background:#fffbeb;">
                  <div style="font-size:12px; color:#92400e;">Não aplicáveis</div>
                  <div style="font-size:24px; font-weight:800; color:#92400e;">${totalNA}</div>
                </div>
              </div>
            </div>

            <div style="margin-bottom:20px;">
              <h2 style="margin:0 0 14px; font-size:18px; color:#111827;">
                Não Conformidades Identificadas
              </h2>
              ${desviosHtml}
            </div>

            <div style="border-top:1px solid #e5e7eb; padding-top:18px; margin-top:24px;">
              <p style="margin:0 0 8px; font-size:14px; color:#374151;">
                Esta mensagem foi enviada automaticamente pelo <strong>Painel SESMT</strong> após o registro de uma nova auditoria 5S.
              </p>
              <p style="margin:0; font-size:12px; color:#6b7280;">
                Gestão de Segurança do Trabalho • Sistema interno de auditorias e inspeções
              </p>
            </div>

          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Painel SESMT" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `Nova Auditoria 5S Registrada - ${doc.local || "Local não informado"} - ${doc.semanaId || ""}`,
      html,
    });

    console.log("E-mail de auditoria enviado com sucesso.");
  } catch (error) {
    console.error("Erro ao enviar e-mail da auditoria:", error);
  }
}

module.exports = {
  sendAuditoriaCreatedEmail,
};
