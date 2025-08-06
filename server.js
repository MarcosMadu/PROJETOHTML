const Inspecao = require('./models/Inspecao');
const Aptidao  = require('./models/Aptidao');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
// const nodemailer = require('nodemailer');  // 🔴 REMOVIDO TEMPORARIAMENTE
const dotenv = require('dotenv');
const multer = require('multer');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const Notificacao = require('./models/Notificacao');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;


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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conexão com MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch(err => console.error('❌ Erro ao conectar no MongoDB:', err));

// Configuração do Multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});
const upload = multer({ storage });
const uploadNotificacaoFotos = upload.array('notificacaoFotos');
const uploadResolucaoFotos  = upload.array('resolucaoFotos');

// Rota inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Enviar notificação
app.post('/enviar', uploadNotificacaoFotos, async (req, res) => {
  try {
    const dados = req.body;
    if (req.files && req.files.length) {
      dados.notificacaoFotos = req.files.map(f => f.filename);
    }
    dados.status = 'Aberta';
    dados.dataRegistro = new Date();

    const nova = new Notificacao(dados);
    await nova.save();

    // ==========================
    // 🔴 ENVIO DE E-MAIL REMOVIDO
    // const transporter = nodemailer.createTransport({
    //   host: 'smtp.office365.com',
    //   port: 587,
    //   secure: false,
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS
    //   }
    // });
    // await transporter.sendMail({
    //   from: process.env.EMAIL_USER,
    //   to:   process.env.EMAIL_TO,
    //   subject: 'Nova Notificação de Risco',
    //   text: JSON.stringify(dados, null, 2)
    // });
    // ==========================

    res.status(200).json({ _id: nova._id });
  } catch (err) {
    console.error('Erro ao enviar notificação:', err);
    res.status(500).send('Erro ao processar notificação.');
  }
});

// Baixa (resolução)
app.post('/baixa', uploadResolucaoFotos, async (req, res) => {
  try {
    const { id, resolvidoPor, resolucaoComentario } = req.body;
    const n = await Notificacao.findById(id);
    if (!n) return res.status(404).send('Notificação não encontrada.');

    n.status = 'Pendente de aprovação';
    n.resolvidoPor = resolvidoPor;
    n.resolucaoComentario = resolucaoComentario;
    n.dataBaixa = new Date();
    if (req.files && req.files.length) {
      n.resolucaoFotos = req.files.map(f => f.filename);
    }
    await n.save();
    res.send('Baixa registrada com sucesso! Aguarde aprovação do gestor.');
  } catch (err) {
    console.error('Erro ao registrar baixa:', err);
    res.status(500).send('Erro ao registrar a baixa da notificação.');
  }
});

// APIs para gestor
app.get('/api/notificacoes', async (req, res) => {
  try {
    const { id, status, encarregado, tecnico, area } = req.query;
    const filtro = {};
    if (id)          filtro._id         = id;
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
app.get('/api/notificacoes-abertas', async (req, res) => {
  try {
    const abertas = await Notificacao.find({ status: 'Aberta' }).select('_id');
    res.json(abertas);
  } catch (err) {
    console.error('Erro ao buscar notificações abertas:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// Aprovar / rejeitar / excluir
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

// Geração de PDF
app.get('/notificacoes/:id/pdf', async (req, res) => {
  try {
    const n = await Notificacao.findById(req.params.id);
    if (!n) return res.status(404).send('Notificação não encontrada.');

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
    doc.save()
       .rect(left, 40, totalW, 50).fill(headerColor).restore();
    doc.fillColor('#fff').fontSize(22)
       .text('REGISTO DE NOTIFICAÇÕES', left, 52, { width: totalW, align: 'center' });

    let y = 100;
    const fieldH = 25, fieldW = colW - 10;
    doc.save().rect(left, y, fieldW, fieldH).fill(dataColor).stroke(borderColor,1).restore();
    doc.fillColor('#000').fontSize(12).text(`ID: ${n._id}`, left+5, y+7);
    doc.save().rect(left+fieldW+20, y, fieldW, fieldH).fill(dataColor).stroke(borderColor,1).restore();
    doc.fillColor('#000').fontSize(12)
       .text(`Classificação: ${n.classificacao || '—'}`,
             left+fieldW+25, y+7);
    y += fieldH + 20;

    function headerCell(text, x) {
      doc.save().rect(x, y, colW, 25).fill(headerColor).stroke(borderColor,1).restore();
      doc.fillColor('#fff').fontSize(12).text(text, x, y+7, { width: colW, align: 'center' });
    }
    function dataCell(text, x) {
      doc.save().rect(x, y+25, colW, 40).fill(dataColor).stroke(borderColor,1).restore();
      doc.fillColor('#000').fontSize(12)
         .text(text, x, y+25+12, { width: colW, align: 'center' });
    }

    headerCell('TÉCNICO RESPONSÁVEL', left);
    headerCell('PRAZO', left+colW);
    dataCell(n.tecnico || '—', left);
    dataCell(n.prazo ? n.prazo.toLocaleDateString() : '—', left+colW);
    y += 25 + 40 + 20;

    headerCell('DATA E HORA', left);
    headerCell('NR RELACIONADA', left+colW);
    dataCell(n.dataRegistro.toLocaleString(), left);
    dataCell(n.nr || '—', left+colW);
    y += 25 + 40 + 20;

    headerCell('ENCARREGADO', left);
    headerCell('Squad', left+colW);
    dataCell(n.encarregado || '—', left);
    dataCell(n.area || '—', left+colW);
    y += 25 + 40 + 20;

    doc.save().rect(left, y, totalW, 25).fill(headerColor).stroke(borderColor,1).restore();
    doc.fillColor('#fff').fontSize(12).text('DESVIO', left, y+7, { width: totalW, align: 'center' });
    doc.save().rect(left, y+25, totalW, 80).fill(dataColor).stroke(borderColor,1).restore();
    doc.fillColor('#000').fontSize(12)
       .text(n.descricao || '—', left+5, y+30, { width: totalW-10, align: 'left' });

    doc.addPage();
    const pageW2 = doc.page.width  - doc.page.margins.left - doc.page.margins.right;
    const pageH2 = doc.page.height - doc.page.margins.top  - doc.page.margins.bottom;
    const top2   = doc.page.margins.top;

    doc.save().rect(left, top2, pageW2, 30).fill('#EFEFEF').stroke('#2E7D32',1).restore();
    doc.fillColor('#000').fontSize(14)
       .text('EVIDÊNCIAS FOTOGRÁFICAS', left, top2+8, { width: pageW2, align: 'center' });

    console.log('Fotos no documento:', n.notificacaoFotos);

    const gap   = 10;
    const cw    = (pageW2 - gap) / 2;
    const ch    = (pageH2 - 30 - gap) / 2;
    const startY2 = top2 + 30 + gap;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const x2 = left + col*(cw+gap);
        const y2 = startY2 + row*(ch+gap);

        doc.save().rect(x2, y2, cw, ch).stroke('#2E7D32',1).restore();

        const idx = row*2 + col;
        if (n.notificacaoFotos && n.notificacaoFotos[idx]) {
          const fn      = n.notificacaoFotos[idx];
          const imgPath = path.join(__dirname, 'uploads', fn);
          console.log('Tentando carregar imagem em:', imgPath);
          if (fs.existsSync(imgPath)) {
            doc.image(imgPath, x2+2, y2+2, { fit: [cw-4, ch-4] });
          } else {
            console.error('❌ Arquivo não encontrado:', imgPath);
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

app.post('/aptidao',
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

// Rota de recebimento do checklist de inspeção
app.post('/inspecao',
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
        fotos[f.fieldname].push(f.filename);
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

// Inicia servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

