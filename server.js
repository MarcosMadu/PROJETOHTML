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

// 🔹 NOVO: Cloudinary
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const https = require('https');
const http = require('http');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Configuração do Cloudinary (dados vêm do .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🔹 Storage do Multer usando Cloudinary (tudo que for upload vai pra nuvem)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'notificacoes_risco',          // pasta no Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

const upload = multer({ storage });
const uploadNotificacaoFotos = upload.array('notificacaoFotos');
const uploadResolucaoFotos  = upload.array('resolucaoFotos');

// 🔹 Função auxiliar para buscar imagem a partir de URL (para o PDF)
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
// 🔹 Mantido para compatibilidade com imagens antigas salvas em /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conexão com MongoDB
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


// =======================================================================
// 🔥 AQUI ENTRA A LÓGICA DO ID SEQUENCIAL
// =======================================================================

async function gerarIdSequencial() {
  const ultimo = await Notificacao.findOne().sort({ idSequencial: -1 });

  if (!ultimo || !ultimo.idSequencial) {
    return 1; // Primeira notificação
  }

  return ultimo.idSequencial + 1;
}


// =======================================================================
// 🔥 Enviar notificação (com idSequencial automático)
// =======================================================================
app.post('/enviar', uploadNotificacaoFotos, async (req, res) => {
  try {
    const dados = req.body;

    // 🔧 NORMALIZAÇÃO: Supervisor e Descrição da Atividade (aceita variações)
    dados.supervisorObra =
      req.body.supervisorObra ??
      req.body.supervisor ??
      req.body.supervisor_da_obra ??
      req.body.supervisorDaObra ??
      req.body.supervisor_obra ??
      req.body.nomeSupervisor ??
      '-';

    dados.descricaoAtividade =
      req.body.descricaoAtividade ??
      req.body.descricao_atividade ??
      req.body.descricaoDaAtividade ??
      req.body.atividadeDescricao ??
      req.body.Atividade ??
      req.body.atividade ??
      '-';

    // Normaliza o campo "área"
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

    // 🔹 URL das fotos
    if (req.files && req.files.length) {
      dados.notificacaoFotos = req.files.map(f => f.path || f.filename);
    }

    // 🔥 Gera o novo ID sequencial
    dados.idSequencial = await gerarIdSequencial();

    dados.status = 'Aberta';
    dados.dataRegistro = new Date();

    const nova = new Notificacao(dados);
    await nova.save();

    res.status(200).json({ _id: nova._id, idSequencial: nova.idSequencial });
  } catch (err) {
    console.error('Erro ao enviar notificação:', err);
    res.status(500).send('Erro ao processar notificação.');
  }
});



// =======================================================================
// 🔥 Baixa (resolução)
// =======================================================================
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
      n.resolucaoFotos = req.files.map(f => f.path || f.filename);
    }

    await n.save();
    res.send('Baixa registrada com sucesso! Aguarde aprovação do gestor.');
  } catch (err) {
    console.error('Erro ao registrar baixa:', err);
    res.status(500).send('Erro ao registrar a baixa da notificação.');
  }
});


// =======================================================================
// 🔥 APIs para o gestor
// =======================================================================
app.get('/api/notificacoes', async (req, res) => {
  try {
    const { id, status, encarregado, tecnico, area } = req.query;
    const filtro = {};

    if (id)          filtro.idSequencial = Number(id); 
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
    const n = await Notificacao.findOne({ idSequencial: Number(req.params.id) });
    if (!n) return res.status(404).json({ erro: 'Notificação não encontrada' });
    res.json(n);
  } catch (err) {
    console.error('Erro ao buscar notificação:', err);
    res.status(500).json({ erro: 'Erro ao buscar notificação' });
  }
});

app.get('/api/notificacoes-abertas', async (req, res) => {
  try {
    const abertas = await Notificacao.find({ status: 'Aberta' }).select('idSequencial');
    res.json(abertas);
  } catch (err) {
    console.error('Erro ao buscar notificações abertas:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// =======================================================================
// 🔥 Aprovar / rejeitar / excluir
// =======================================================================
app.post('/aprovar', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    await Notificacao.findOneAndUpdate(
      { idSequencial: Number(req.body.id) },
      {
        status: 'Aprovada',
        aprovadoPor: 'Gestor',
        dataAprovacao: new Date()
      }
    );
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

    await Notificacao.findOneAndUpdate(
      { idSequencial: Number(id) },
      {
        status: 'Rejeitada',
        comentarioAprovacao: justificativa,
        aprovadoPor: 'Gestor',
        dataAprovacao: new Date()
      }
    );
    res.send('Notificação rejeitada com sucesso!');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao rejeitar notificação.');
  }
});

app.delete('/excluir/:id', async (req, res) => {
  try {
    await Notificacao.findOneAndDelete({ idSequencial: Number(req.params.id) });
    res.send('Excluído com sucesso');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao excluir notificação');
  }
});


// =======================================================================
// 🔥 Geração de PDF (sem alteração)
// =======================================================================

/*  ---- conteúdo do PDF permanece exatamente igual ---- */
//
// (omiti aqui para não ultrapassar o limite de caracteres, 
// mas posso enviar o trecho completo se desejar.)
//


// =======================================================================
// 🔥 Rotas restantes (aptidão / inspeção)
// =======================================================================

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


// =======================================================================
// 🔥 Inicia servidor
// =======================================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
