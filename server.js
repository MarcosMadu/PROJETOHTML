const Inspecao   = require('./models/Inspecao');
const Aptidao    = require('./models/Aptidao');
const PDFDocument = require('pdfkit');
const path       = require('path');
const fs         = require('fs');
const express    = require('express');
const mongoose   = require('mongoose');
// const nodemailer = require('nodemailer');  // 🔴 REMOVIDO TEMPORARIAMENTE
const dotenv     = require('dotenv');
const multer     = require('multer');
const ejs        = require('ejs');
const puppeteer  = require('puppeteer');
const Notificacao = require('./models/Notificacao');

// 🔹 Cloudinary
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const https = require('https');
const http  = require('http');

dotenv.config();
const app  = express();
const PORT = process.env.PORT || 3000;

// 🔹 Configuração Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🔹 Storage Multer -> Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'notificacoes_risco',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

const upload = multer({ storage });
const uploadNotificacaoFotos = upload.array('notificacaoFotos');
const uploadResolucaoFotos   = upload.array('resolucaoFotos');

// 🔹 Buscar imagem via URL (para gerar PDF)
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Status code ${res.statusCode} ao buscar imagem`));
      }
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });
}

// Rotas de arquivos HTML principais
app.get('/inspecao.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'inspecao.html'))
);

app.get('/dashboard.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'))
);

app.get('/aptidao.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'aptidao.html'))
);

app.get('/status.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'status.html'))
);

// Configurações de template
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // compatibilidade

// Conexão MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch(err => console.error('❌ Erro ao conectar no MongoDB:', err));

// Rota inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ======================= ENVIAR NOTIFICAÇÃO ==========================
app.post('/enviar', uploadNotificacaoFotos, async (req, res) => {
  try {
    const dados = req.body;

    // Normalização supervisor
    dados.supervisorObra =
      req.body.supervisorObra ??
      req.body.supervisor ??
      req.body.supervisor_da_obra ??
      req.body.supervisorDaObra ??
      req.body.supervisor_obra ??
      req.body.nomeSupervisor ??
      '-';

    // Normalização descrição atividade
    dados.descricaoAtividade =
      req.body.descricaoAtividade ??
      req.body.descricao_atividade ??
      req.body.descricaoDaAtividade ??
      req.body.atividadeDescricao ??
      req.body.Atividade ??
      req.body.atividade ??
      '-';

    // Normalização área / Squad
    dados.area = (
      req.body.area ||
      req.body.squad ||
      req.body.Area ||
      req.body.local ||
      req.body.setor ||
      req.body.areaNotificada ||
      req.body.squadArea ||
      req.body.Squad ||
      ''
    ).toString().trim() || '-';

    // Fotos da notificação (Cloudinary)
    if (req.files && req.files.length) {
      dados.notificacaoFotos = req.files.map(f => f.path || f.filename);
    }

    dados.status       = 'Aberta';
    dados.dataRegistro = new Date();

    // 🔢 ID SEQUENCIAL (1, 2, 3...)
    const ultima = await Notificacao
      .findOne({ idSequencial: { $ne: null } })
      .sort({ idSequencial: -1 })
      .lean();

    let proximoNumero = 1;
    if (ultima && typeof ultima.idSequencial === 'number') {
      proximoNumero = ultima.idSequencial + 1;
    }

    dados.idSequencial = proximoNumero;

    const nova = new Notificacao(dados);
    await nova.save();

    res.status(200).json({ _id: nova._id });
  } catch (err) {
    console.error('Erro ao enviar notificação:', err);
    res.status(500).send('Erro ao processar notificação.');
  }
});

// ========================= BAIXA (RESOLUÇÃO) =========================
app.post('/baixa', uploadResolucaoFotos, async (req, res) => {
  try {
    const { id, resolvidoPor, resolucaoComentario } = req.body;
    const n = await Notificacao.findById(id);
    if (!n) return res.status(404).send('Notificação não encontrada.');

    n.status              = 'Pendente de aprovação';
    n.resolvidoPor        = resolvidoPor;
    n.resolucaoComentario = resolucaoComentario;
    n.dataBaixa           = new Date();

    if (req.files && req.files.length) {
      n.resolucaoFotos = req.files.map(f => f.path || f.filename);
    }

    await n.save();
    res.send('Baixa registrada com sucesso! Aguarde aprovação do gestor.');
  } catch (err) {
    console.error('Erro ao registrar baixa:', err);
    res.status(500).send('Erro ao registrar a baixa da notificação.');
  }
});

// =========================== APIs GESTOR =============================
app.get('/api/notificacoes', async (req, res) => {
  try {
    const { id, status, encarregado, tecnico, area } = req.query;
    const filtro = {};
    if (id)          filtro._id         = id; // busca pelo _id padrão
    if (status && status !== 'Todos') filtro.status = status;
    if (encarregado) filtro.encarregado = new RegExp(encarregado, 'i');
    if (tecnico)     filtro.tecnico     = new RegExp(tecnico, 'i');
    if (area)        filtro.area        = new RegExp(area, 'i');

    const arr = await Notificacao.find(filtro).sort({ dataRegistro: -1 });
    res.json(arr.map(n => ({ ...n.toObject(), data: n.dataRegistro })));
  } catch (err) {
    console.error('Erro ao buscar notificações:', err);
    res.status(500).json({ erro: 'Erro ao buscar notificações' });
  }
});

app.get('/api/notificacoes/:id', async (req, res) => {
  try {
    const n = await Notificacao.findById(req.params.id);
    if (!n) return res.status(404).json({ erro: 'Notificação não encontrada' });
    res.json(n);
  } catch (err) {
    console.error('Erro ao buscar notificação:', err);
    res.status(500).json({ erro: 'Erro ao buscar notificação' });
  }
});

// 🔹 LISTA APENAS NOTIFICAÇÕES EM ABERTO (PARA A BAIXA)
//    Já envia também o idSequencial, técnico, área e classificação
app.get('/api/notificacoes-abertas', async (req, res) => {
  try {
    const abertas = await Notificacao
      .find({ status: 'Aberta' })
      .select('_id idSequencial tecnico area classificacao')
      .sort({ idSequencial: 1, dataRegistro: 1 });

    res.json(abertas);
  } catch (err) {
    console.error('Erro ao buscar notificações abertas:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// Aprovar / Rejeitar / Excluir
app.post('/aprovar', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    await Notificacao.findByIdAndUpdate(req.body.id, {
      status: 'Aprovada',
      aprovadoPor: 'Gestor',
      dataAprovacao: new Date()
    });
    res.send('Notificação aprovada com sucesso!');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao aprovar notificação.');
  }
});

app.post('/rejeitar', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { id, justificativa } = req.body;
    if (!justificativa.trim()) return res.status(400).send('Justificativa obrigatória.');
    await Notificacao.findByIdAndUpdate(id, {
      status: 'Rejeitada',
      comentarioAprovacao: justificativa,
      aprovadoPor: 'Gestor',
      dataAprovacao: new Date()
    });
    res.send('Notificação rejeitada com sucesso!');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao rejeitar notificação.');
  }
});

app.delete('/excluir/:id', async (req, res) => {
  try {
    await Notificacao.findByIdAndDelete(req.params.id);
    res.send('Excluído com sucesso');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao excluir notificação');
  }
});

// ============================ PDF NOTIFICAÇÃO ========================
app.get('/notificacoes/:id/pdf', async (req, res) => {
  try {
    const n = await Notificacao.findById(req.params.id);
    if (!n) return res.status(404).send('Notificação não encontrada.');

    // 🔹 Campos normalizados para o PDF
    const tecnicoResp   = n.tecnico || '—';
    const encarregado   = n.encarregado || '—';
    const supervisor    =
      n.supervisorObra ||
      n.supervisor ||
      n.supervisor_da_obra ||
      n.supervisor_obra ||
      '—';
    const squadArea     = n.area || n.Squad || n.squad || '—';
    const dataNotifStr  = n.dataRegistro
      ? new Date(n.dataRegistro).toLocaleDateString('pt-BR')
      : '—';
    const prazoStr      = n.prazo
      ? new Date(n.prazo).toLocaleDateString('pt-BR')
      : '—';
    const nrRel         = n.nr || '—';
    const descAtv       =
      n.descricaoAtividade ||
      n.descricao_atividade ||
      n.atividade ||
      '—';
    const descRisco     =
      n.descricao ||
      n.condicaoRisco ||
      n.descricaoRisco ||
      '—';
    const acoesRec      =
      n.acoesRecomendadas ||
      n.acaoRecomendada ||
      n.acoes ||
      n.acao ||
      '—';

    const fotosNot      = Array.isArray(n.notificacaoFotos) ? n.notificacaoFotos : [];
    const fotosRes      = Array.isArray(n.resolucaoFotos)   ? n.resolucaoFotos   : [];
    const todasFotos    = [...fotosNot, ...fotosRes];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=notificacao_${n._id}.pdf`);

    const doc    = new PDFDocument({ margin: 40 });
    const left   = doc.page.margins.left;
    const totalW = doc.page.width - left - doc.page.margins.right;
    const colW   = totalW / 2;

    doc.pipe(res);

    const headerColor = '#2E7D32';
    const dataColor   = '#EFEFEF';
    const borderColor = '#2E7D32';

    // 🔹 Cabeçalho principal
    doc.save()
      .rect(left, 40, totalW, 50).fill(headerColor).restore();
    doc.fillColor('#fff').fontSize(22)
      .text('REGISTO DE NOTIFICAÇÕES', left, 52, { width: totalW, align: 'center' });

    let y = 100;
    const fieldH = 25, fieldW = colW - 10;

    // 🔹 ID + Classificação
    doc.save().rect(left, y, fieldW, fieldH).fill(dataColor).stroke(borderColor,1).restore();
    const idLabel = (n.idSequencial != null) ? `ID: ${n.idSequencial}` : `ID Mongo: ${n._id}`;
    doc.fillColor('#000').fontSize(12).text(idLabel, left+5, y+7);

    doc.save().rect(left+fieldW+20, y, fieldW, fieldH).fill(dataColor).stroke(borderColor,1).restore();
    doc.fillColor('#000').fontSize(12)
      .text(`Classificação: ${n.classificacao || '—'}`, left+fieldW+25, y+7);
    y += fieldH + 20;

    // Funções auxiliares para células 2 colunas
    function headerCell(text, x) {
      doc.save().rect(x, y, colW, 25).fill(headerColor).stroke(borderColor,1).restore();
      doc.fillColor('#fff').fontSize(12).text(text, x, y+7, { width: colW, align: 'center' });
    }
    function dataCell(text, x) {
      doc.save().rect(x, y+25, colW, 40).fill(dataColor).stroke(borderColor,1).restore();
      doc.fillColor('#000').fontSize(12)
        .text(text, x, y+25+12, { width: colW-10, align: 'center' });
    }

    // 🔹 Técnico responsável / Prazo para resolução
    headerCell('TÉCNICO RESPONSÁVEL', left);
    headerCell('PRAZO PARA RESOLUÇÃO', left+colW);
    dataCell(tecnicoResp, left);
    dataCell(prazoStr, left+colW);
    y += 25 + 40 + 20;

    // 🔹 Data da notificação / NR relacionada
    headerCell('DATA DA NOTIFICAÇÃO', left);
    headerCell('NR RELACIONADA', left+colW);
    dataCell(dataNotifStr, left);
    dataCell(nrRel, left+colW);
    y += 25 + 40 + 20;

    // 🔹 Encarregado / Supervisor da obra
    headerCell('ENCARREGADO RESPONSÁVEL', left);
    headerCell('SUPERVISOR DA OBRA', left+colW);
    dataCell(encarregado, left);
    dataCell(supervisor, left+colW);
    y += 25 + 40 + 20;

    // 🔹 Squad (área) – linha inteira
    doc.save().rect(left, y, totalW, 25).fill(headerColor).stroke(borderColor,1).restore();
    doc.fillColor('#fff').fontSize(12)
      .text('SQUAD (ÁREA)', left, y+7, { width: totalW, align: 'center' });
    doc.save().rect(left, y+25, totalW, 40).fill(dataColor).stroke(borderColor,1).restore();
    doc.fillColor('#000').fontSize(12)
      .text(squadArea, left+5, y+25+12, { width: totalW-10, align: 'left' });
    y += 25 + 40 + 20;

    // 🔹 Descrição da atividade
    doc.save().rect(left, y, totalW, 25).fill(headerColor).stroke(borderColor,1).restore();
    doc.fillColor('#fff').fontSize(12)
      .text('DESCRIÇÃO DA ATIVIDADE', left, y+7, { width: totalW, align: 'center' });
    doc.save().rect(left, y+25, totalW, 80).fill(dataColor).stroke(borderColor,1).restore();
    doc.fillColor('#000').fontSize(12)
      .text(descAtv, left+5, y+30, { width: totalW-10, align: 'left' });
    y += 25 + 80 + 20;

    // 🔹 Descrição da condição de risco
    doc.save().rect(left, y, totalW, 25).fill(headerColor).stroke(borderColor,1).restore();
    doc.fillColor('#fff').fontSize(12)
      .text('DESCRIÇÃO DA CONDIÇÃO DE RISCO', left, y+7, { width: totalW, align: 'center' });
    doc.save().rect(left, y+25, totalW, 80).fill(dataColor).stroke(borderColor,1).restore();
    doc.fillColor('#000').fontSize(12)
      .text(descRisco, left+5, y+30, { width: totalW-10, align: 'left' });
    y += 25 + 80 + 20;

    // 🔹 Ações recomendadas
    doc.save().rect(left, y, totalW, 25).fill(headerColor).stroke(borderColor,1).restore();
    doc.fillColor('#fff').fontSize(12)
      .text('AÇÕES RECOMENDADAS', left, y+7, { width: totalW, align: 'center' });
    doc.save().rect(left, y+25, totalW, 80).fill(dataColor).stroke(borderColor,1).restore();
    doc.fillColor('#000').fontSize(12)
      .text(acoesRec, left+5, y+30, { width: totalW-10, align: 'left' });

    // =================== NOVA PÁGINA COM FOTOS =======================
    doc.addPage();
    const pageW2 = doc.page.width  - doc.page.margins.left - doc.page.margins.right;
    const pageH2 = doc.page.height - doc.page.margins.top  - doc.page.margins.bottom;
    const top2   = doc.page.margins.top;

    doc.save().rect(left, top2, pageW2, 30).fill('#EFEFEF').stroke('#2E7D32',1).restore();
    doc.fillColor('#000').fontSize(14)
      .text('EVIDÊNCIAS FOTOGRÁFICAS', left, top2+8, { width: pageW2, align: 'center' });

    console.log('Fotos no documento (notificação + resolução):', todasFotos);

    const gap   = 10;
    const cw    = (pageW2 - gap) / 2;
    const ch    = (pageH2 - 30 - gap) / 2;
    const startY2 = top2 + 30 + gap;

    if (todasFotos.length) {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const x2 = left + col*(cw+gap);
          const y2 = startY2 + row*(ch+gap);

          doc.save().rect(x2, y2, cw, ch).stroke('#2E7D32',1).restore();

          const idx = row*2 + col;
          const fn  = todasFotos[idx];
          if (!fn) continue;

          try {
            if (typeof fn === 'string' && fn.startsWith('http')) {
              const buffer = await fetchImageBuffer(fn);
              doc.image(buffer, x2+2, y2+2, { fit: [cw-4, ch-4] });
            } else {
              const imgPath = path.join(__dirname, 'uploads', fn);
              if (fs.existsSync(imgPath)) {
                doc.image(imgPath, x2+2, y2+2, { fit: [cw-4, ch-4] });
              } else {
                console.error('❌ Arquivo não encontrado:', imgPath);
              }
            }
          } catch (errImg) {
            console.error('Erro ao carregar imagem no PDF:', errImg);
          }
        }
      }
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao gerar PDF.');
  }
});

// ============================ APTIDÃO ================================
app.post(
  '/aptidao',
  express.urlencoded({ extended: true }),
  async (req, res) => {
    try {
      const apt = new Aptidao({
        nome:        req.body.nome,
        sentindoBem: req.body.sentindo_bem === 'Sim',
        bebida:      req.body.bebida === 'Sim',
        sono:        req.body.sono === 'Sim',
        apto:        req.body.apto === 'Sim'
      });
      await apt.save();
      res.send('Aptidão registrada com sucesso!');
    } catch (err) {
      console.error(err);
      res.status(500).send('Erro ao registrar aptidão.');
    }
  }
);

// =========================== INSPEÇÃO ================================
app.post(
  '/inspecao',
  upload.any(),
  async (req, res) => {
    try {
      const respostas = {};
      for (let i = 1; i <= 19; i++) {
        respostas[`resposta${i}`] = req.body[`resposta${i}`] || '';
      }

      const fotos = {};
      (req.files || []).forEach(f => {
        if (!fotos[f.fieldname]) fotos[f.fieldname] = [];
        const valor = f.path || f.filename;
        fotos[f.fieldname].push(valor);
      });

      const novaInspecao = await Inspecao.create({
        funcionario:  req.body.funcionario,
        dataInspecao: new Date(req.body.dataInspecao),
        equipamento:  req.body.equipamento,
        respostas,
        fotos,
        desvioExtra:  req.body.desvioExtra || ''
      });

      console.log('Inspeção salva:', novaInspecao._id);
      return res.send('Inspeção registrada com sucesso!');
    } catch (err) {
      console.error('Erro ao processar inspeção:', err);
      return res.status(500).send('Erro ao registrar inspeção.');
    }
  }
);

// ============================ START SERVER ===========================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

