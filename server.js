const Inspecao    = require('./models/Inspecao');
const Aptidao     = require('./models/Aptidao');
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');
const express     = require('express');
const mongoose    = require('mongoose');
const dotenv      = require('dotenv');
const multer      = require('multer');
const Notificacao = require('./models/Notificacao');

// ✅ 5S
const Auditoria5S = require('./models/avaliacao5s/Auditoria5S');

// 🔹 Cloudinary
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

dotenv.config();
const app  = express();
const PORT = process.env.PORT || 3000;

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🔹 Storage NOTIFICAÇÕES
const storageNotificacao = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'notificacoes_risco',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

// 🔹 Storage 5S
const storage5S = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'auditorias_5s',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

const uploadNotificacao = multer({ storage: storageNotificacao });
const upload5S          = multer({ storage: storage5S });

// ================= MIDDLEWARE =================
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ================= MONGODB ====================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ MongoDB erro:', err));

// ================= ROTAS HTML =================
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/avaliacao.html', (_, res) => res.sendFile(path.join(__dirname, 'public', 'avaliacao.html')));

// ================= 5S =========================

// Semana atual
app.get('/api/5s/semana-atual', (_, res) => {
  const d = new Date();
  const week = Math.ceil((((d - new Date(d.getFullYear(),0,1)) / 86400000) + d.getDay()+1)/7);
  res.json({
    semanaId: `${d.getFullYear()}-W${String(week).padStart(2,'0')}`,
    auditorSemana: 'AUDITOR AUTOMÁTICO'
  });
});

// ✅ SALVAR AUDITORIA 5S (UPLOAD REAL)
app.post('/api/5s/auditorias', upload5S.any(), async (req, res) => {
  try {
    if (!req.body.payload) {
      return res.status(400).json({ error: 'Payload ausente' });
    }

    const payload = JSON.parse(req.body.payload);

    // Indexa arquivos por fieldname
    const filesMap = {};
    (req.files || []).forEach(f => {
      filesMap[f.fieldname] = {
        url: f.path,
        public_id: f.filename,
        name: f.originalname,
        type: f.mimetype,
        size: f.size
      };
    });

    const itens = payload.itens.map(it => ({
      ...it,

      // ✅ CONFORME
      conformeFotos: (it.conformeFotos || []).map(meta =>
        filesMap[meta.field] ? filesMap[meta.field] : {
          url: null,
          name: meta.name,
          type: meta.type,
          size: meta.size
        }
      ),

      // ✅ NÃO CONFORME
      desvios: (it.desvios || []).map(d => ({
        responsavel: d.responsavel,
        foto: d.foto && filesMap[d.foto.field]
          ? filesMap[d.foto.field]
          : null,
        status: 'ABERTO'
      }))
    }));

    const doc = await Auditoria5S.create({
      semanaId: payload.semanaId,
      auditorSemana: payload.auditorSemana,
      dataHora: payload.dataHora,
      setor: payload.setor,
      itens
    });

    res.status(201).json({ ok: true, auditoriaId: doc._id });

  } catch (err) {
    console.error('❌ ERRO 5S:', err);
    res.status(500).json({ error: err.message });
  }
});

// LISTAR
app.get('/api/5s/auditorias', async (_, res) => {
  const list = await Auditoria5S.find().sort({ createdAt: -1 }).lean();
  res.json(list);
});

// DETALHE
app.get('/api/5s/auditorias/:id', async (req, res) => {
  const doc = await Auditoria5S.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Não encontrado' });
  res.json(doc);
});

// EXCLUIR
app.delete('/api/5s/auditorias/:id', async (req, res) => {
  await Auditoria5S.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ================= START ======================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
