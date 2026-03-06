const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function enviarEmailAuditoria(auditoria) {

  const desvios = auditoria.itens
    .filter(item => item.status === "NC")
    .map(item => `
      <tr>
        <td>${item.itemId}</td>
        <td>${item.texto}</td>
        <td>${item.desvios?.[0]?.responsavel || "-"}</td>
      </tr>
    `).join("");

  const html = `
  <h2>Auditoria 5S Realizada</h2>

  <p><b>Maturidade:</b> ${auditoria.maturidade}</p>
  <p><b>Local:</b> ${auditoria.area}</p>
  <p><b>Auditor programado:</b> ${auditoria.auditorProgramado}</p>
  <p><b>Auditor realizador:</b> ${auditoria.auditor}</p>
  <p><b>Data:</b> ${auditoria.dataHora}</p>

  <h3>Itens com Desvio</h3>

  <table border="1" cellpadding="6">
    <tr>
      <th>Item</th>
      <th>Descrição</th>
      <th>Responsável</th>
    </tr>

    ${desvios || "<tr><td colspan='3'>Nenhum desvio</td></tr>"}

  </table>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.AUDITORIA_EMAIL_TO,
    subject: "Auditoria 5S Realizada",
    html
  });

}

module.exports = enviarEmailAuditoria;