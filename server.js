const Inspecao    = require('./models/Inspecao');
const Aptidao     = require('./models/Aptidao');
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');
const express     = require('express');
const mongoose    = require('mongoose');
// const nodemailer = require('nodemailer');
const dotenv      = require('dotenv');
const multer      = require('multer');
const ejs         = require('ejs');
const Notificacao = require('./models/Notificacao');
const { sendAuditoriaCreatedEmail } = require('./src/utils/mailer');

// ✅ 5S (NOVO) — model
const Auditoria5S = require('./models/avaliacao5s/Auditoria5S');
const Calendario5S = require('./models/avaliacao5s/Calendario5S');
// 🔹 Cloudinary
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const https = require('https');
const http  = require('http');


dotenv.config();
const app  = express();
const PORT = process.env.PORT || 3000;

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage (Multer + Cloudinary) — ✅ reutiliza a mesma pasta das notificações
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'notificacoes_risco', // ✅ mesma pasta
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

const upload = multer({ storage });
const uploadNotificacaoFotos = upload.array('notificacaoFotos');
const uploadResolucaoFotos   = upload.array('resolucaoFotos');

// Buscar imagem via URL
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

// ========================== EJS ==========================
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ======================== Middlewares =====================
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public')));

// Mantém por compatibilidade (se algo antigo ainda usa /uploads local)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========================= MongoDB ========================
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000
    });

    console.log('✅ Conectado ao MongoDB');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('❌ Erro ao conectar no MongoDB:', err);
    process.exit(1);
  }
}

// ========================= Rotas HTML =====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

// ✅ 5S (NOVO)
app.get('/avaliacao.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'avaliacao.html'))
);

// ===================================================================
// ============================ 5S (NOVO) =============================
// ===================================================================

// Lista de nomes (auditor automático e responsáveis por tratativa)
const NOMES_5S = [
  "ALLAN DO NASCIMENTO MORAES",
  "ANDRE DA CONCEICAO ALVES",
  "ANGLA RAKEL SILVA ALMEIDA",
  "ANTONY CHE GUEVARA CAVALCANTE DOS SANTOS",
  "CLEITON DE PAULA BATISTA",
  "DEIVIANE CONCEICAO PEREIRA",
  "EDUARDO DE SOUSA",
  "FERNANDO QUEIROZ DA SILVA",
  "HELIO BARBOSA DOS SANTOS",
  "HERACLITO HENRIQUE SANTANA LOPES",
  "JANAINA KETLEY ANDRADE RIBEIRO",
  "JEOVANE DOS SANTOS SILVA",
  "JORGE MOUZINHO CARVALHO",
  "LUCRECIA SANTOS DO NASCIMENTO",
  "LUIS ANTONIO FELIX DE VASCONCELLOS",
  "MARCELO MONTANDON MARCAL JUNIOR",
  "MARCOS OLIVEIRA MENEZES",
  "RAFAEL HENRIQUE ALVES RIBEIRO",
  "RAPHAEL JOSE PEREIRA DA SILVA",
  "RODRIGO BARBOSA DA SILVA",
  "MARCOS VINICUS BATISTA RIBEIRO",
  "TAINARA BERTUNES DOS SANTOS",
  "VERONICA LUIZA GOMES DE MENEZES",
  "WILDSON DA SILVA BARROS"
];

// Semana por mês (ex.: 2026-S1-FEV)
function getSemanaId(d = new Date()) {
  const meses = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

  const ano = d.getFullYear();
  const mes = meses[d.getMonth()];
  const dia = d.getDate();

  const semanaDoMes = Math.ceil(dia / 7);

  return `${ano}-S${semanaDoMes}-${mes}`;
}

// Auditor automático baseado no número da semana (cíclico)
function getAuditorAutomatico(semanaId) {
  const match = String(semanaId).match(/-S(\d+)-/);
  const semanaNumero = match ? Number(match[1]) : 1;
  const idx = (semanaNumero - 1) % NOMES_5S.length;
  return NOMES_5S[idx];
}

// GET semana atual + auditor automático
app.get('/api/5s/semana-atual', (req, res) => {
  const semanaId = getSemanaId(new Date());
  const auditorSemana = getAuditorAutomatico(semanaId);
  return res.json({ semanaId, auditorSemana });
});

// ===================================================================
// ======================= CALENDÁRIO 5S ==============================
// ===================================================================

// GET listar calendário 5S
app.get('/api/5s/calendario', async (req, res) => {
  try {
    const { semanaId, local, tipoAuditoria } = req.query;

    const filtro = {};
    if (semanaId) filtro.semanaId = semanaId;
    if (local) filtro.local = local;
    if (tipoAuditoria) filtro.tipoAuditoria = tipoAuditoria;

    const lista = await Calendario5S.find(filtro)
      .sort({ semanaId: 1, local: 1, tipoAuditoria: 1 })
      .lean();

    return res.json(lista);
  } catch (err) {
    console.error('Erro ao listar calendário 5S:', err);
    return res.status(500).json({ error: 'Erro ao listar calendário 5S.' });
  }
});

// GET buscar responsável programado por semana/local/tipo
app.get('/api/5s/calendario/responsavel', async (req, res) => {
  try {
    const { semanaId, local, tipoAuditoria } = req.query;

    if (!semanaId || !local) {
      return res.status(400).json({
        error: 'Informe semanaId e local.'
      });
    }

    let item = null;

    // 1) tenta achar programação específica do tipo
    if (tipoAuditoria) {
      item = await Calendario5S.findOne({
        semanaId,
        local,
        tipoAuditoria
      }).lean();
    }

    // 2) fallback para "Ambos"
    if (!item) {
      item = await Calendario5S.findOne({
        semanaId,
        local,
        tipoAuditoria: 'Ambos'
      }).lean();
    }

    if (!item) {
      return res.json({
        semanaId,
        local,
        tipoAuditoria: tipoAuditoria || null,
        responsavel: null,
        encontrado: false
      });
    }

    return res.json({
      ...item,
      encontrado: true
    });
  } catch (err) {
    console.error('Erro ao buscar responsável do calendário 5S:', err);
    return res.status(500).json({ error: 'Erro ao buscar responsável do calendário 5S.' });
  }
});

// POST cadastrar/atualizar calendário 5S
app.post('/api/5s/calendario', async (req, res) => {
  try {
    const {
      semanaId,
      dataInicio,
      dataFim,
      local,
      responsavel,
      tipoAuditoria,
      observacoes
    } = req.body || {};

    if (!semanaId || !local || !responsavel) {
      return res.status(400).json({
        error: 'semanaId, local e responsavel são obrigatórios.'
      });
    }

    const tipoFinal = tipoAuditoria || 'Ambos';

    const doc = await Calendario5S.findOneAndUpdate(
      {
        semanaId,
        local,
        tipoAuditoria: tipoFinal
      },
      {
        semanaId,
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
        local,
        responsavel,
        tipoAuditoria: tipoFinal,
        observacoes: observacoes || null
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return res.json({
      ok: true,
      item: doc
    });
  } catch (err) {
    console.error('Erro ao salvar calendário 5S:', err);
    return res.status(500).json({ error: 'Erro ao salvar calendário 5S.' });
  }
});

// DELETE remover item do calendário 5S
app.delete('/api/5s/calendario/:id', async (req, res) => {
  try {
    const del = await Calendario5S.findByIdAndDelete(req.params.id);
    if (!del) {
      return res.status(404).json({ error: 'Registro do calendário não encontrado.' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir item do calendário 5S:', err);
    return res.status(500).json({ error: 'Erro ao excluir item do calendário 5S.' });
  }
});

// ===================================================================
// ============================ 5S (UPLOAD REAL) =======================
// ===================================================================

// 🔹 Multer/Cloudinary específico do 5S (pasta separada)
const storage5S = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'auditorias_5s',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

const upload5S = multer({ storage: storage5S });

// POST salvar auditoria 5S (multipart/form-data + fotos no Cloudinary)
app.post('/api/5s/auditorias', upload5S.any(), async (req, res) => {
  try {

    console.log('📥 POST /api/5s/auditorias acionado');

    // O avaliacao.html manda FormData com:
    // - payload (JSON string)
    // - conf_<itemId>_<idx> (fotos Conforme)
    // - nc_<itemId>_<idx>   (fotos dos desvios NC)

    const raw = req.body?.payload;
    if (!raw) {
      return res.status(400).json({ error: 'Campo "payload" ausente no form-data.' });
    }

    let payload;
    try { 
      payload = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: 'Campo "payload" inválido (JSON malformado).' });
    }

    // Validação mínima
    if (
      !payload ||
      typeof payload !== 'object' ||
      !payload.semanaId ||
      !payload.auditorSemana ||
      !payload.dataHora ||
      !Array.isArray(payload.itens) ||
      payload.itens.length === 0
    ) {
      return res.status(400).json({
        error: 'Payload inválido.',
        detalhe: 'Campos obrigatórios ausentes ou itens vazio.'
      });
    }

    // Indexar arquivos recebidos (Cloudinary URL vem em file.path)
    const fileIndex = new Map();
(req.files || []).forEach((f) => {
  // CloudinaryStorage costuma trazer a URL em f.path
  const secureUrl = typeof f.path === "string" ? f.path : null;

  fileIndex.set(f.fieldname, {
    public_id: f.filename || null,
    secure_url: secureUrl,     // ✅ campo principal
    url: secureUrl,            // ✅ fallback
    original_filename: f.originalname || null,
    format: (f.mimetype || "").split("/")[1] || null,
    bytes: typeof f.size === "number" ? f.size : null,
    resource_type: "image",

    // Compatibilidade com o front antigo
    name: f.originalname || null,
    size: typeof f.size === "number" ? f.size : null,
    type: f.mimetype || null
  });
});


    // Montar itens com URLs
    const itensOut = payload.itens.map((it) => {
      const out = { ...it };

      // Conforme
      if (Array.isArray(it.conformeFotos)) {
        out.conformeFotos = it.conformeFotos.map((meta) => {
          const found = meta?.field ? fileIndex.get(meta.field) : null;
          if (!found) {
            return {
              url: null,
              public_id: null,
              name: meta?.name || null,
              type: meta?.type || null,
              size: meta?.size || null
            };
          }
        return {
  public_id: found.public_id,
  secure_url: found.secure_url || found.url || null,
  url: found.url || found.secure_url || null,

  original_filename: found.original_filename || found.name || null,
  format: found.format || null,
  bytes: found.bytes ?? found.size ?? null,
  resource_type: found.resource_type || "image",

  // compat
  name: meta?.name || found.name || found.original_filename || null,
  type: meta?.type || found.type || null,
  size: meta?.size || found.size || null
};
        });
      } else {
        out.conformeFotos = [];
      }

      // NC
      if (Array.isArray(it.desvios)) {
        out.desvios = it.desvios.map((d) => {
          const outD = { ...d };

          if (d?.foto && d.foto.field) {
            const found = fileIndex.get(d.foto.field);
           outD.foto = found
  ? {
      public_id: found.public_id,
      secure_url: found.secure_url || found.url || null,
      url: found.url || found.secure_url || null,

      original_filename: found.original_filename || found.name || null,
      format: found.format || null,
      bytes: found.bytes ?? found.size ?? null,
      resource_type: found.resource_type || "image",

      // compat
      name: d.foto?.name || found.name || found.original_filename || null,
      type: d.foto?.type || found.type || null,
      size: d.foto?.size || found.size || null
    }
              : {
                  url: null,
                  public_id: null,
                  name: d.foto?.name || null,
                  type: d.foto?.type || null,
                  size: d.foto?.size || null
                };
          } else {
            outD.foto = null;
          }

          return outD;
        });
      } else {
        out.desvios = [];
      }

      return out;
    });

    const docToSave = {
       semanaId: payload.semanaId,
  auditorSemana: payload.auditorSemana,
  auditorProgramado: payload.auditorProgramado || getAuditorAutomatico(payload.semanaId),
  dataHora: payload.dataHora,
  setor: payload.setor || payload.local || null,
  local: payload.local || payload.setor || null,
  maturidade: payload.maturidade ?? null,
  tipoAuditoria: payload.tipoAuditoria || null,
  itens: itensOut
    };

   console.log('🧾 Preparando para salvar auditoria 5S...');
   const doc = await Auditoria5S.create(docToSave);

console.log('📩 Tentando enviar e-mail da auditoria 5S...', String(doc._id));

try {
  await sendAuditoriaCreatedEmail(doc);
  console.log('✅ E-mail da auditoria 5S enviado com sucesso.');
} catch (emailErr) {
  console.error('❌ Erro ao enviar e-mail da auditoria 5S:', emailErr);
}

return res.status(201).json({
  ok: true,
  auditoriaId: String(doc._id)
});

  } catch (err) {
    console.error('❌ ERRO AO SALVAR AUDITORIA 5S (UPLOAD)');
    console.error('Mensagem:', err.message);
    console.error(err);

    return res.status(500).json({
      error: 'Erro ao salvar auditoria 5S.',
      detalhe: err.message
    });
  }
});

// GET listar auditorias 5S (pode filtrar por semanaId)
app.get('/api/5s/auditorias', async (req, res) => {
  try {
    const { semanaId } = req.query;
    const filtro = semanaId ? { semanaId } : {};
    const list = await Auditoria5S.find(filtro).sort({ createdAt: -1 }).lean();
    return res.json(list);
  } catch (err) {
    console.error('Erro ao listar auditorias 5S:', err);
    return res.status(500).json({ error: 'Erro ao listar auditorias 5S.' });
  }
});

// GET detalhes de 1 auditoria 5S
app.get('/api/5s/auditorias/:id', async (req, res) => {
  try {
    const doc = await Auditoria5S.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Registro não encontrado.' });
    return res.json(doc);
  } catch (err) {
    console.error('Erro ao buscar auditoria 5S:', err);
    return res.status(500).json({ error: 'Erro ao buscar auditoria 5S.' });
  }
});

// DELETE individual (para o fallback do seu gestao.html)
app.delete('/api/5s/auditorias/:id', async (req, res) => {
  try {
    const del = await Auditoria5S.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ error: 'Registro não encontrado.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir auditoria 5S:', err);
    return res.status(500).json({ error: 'Erro ao excluir auditoria 5S.' });
  }
});

// POST bulk-delete (o seu gestao.html tenta primeiro essa rota)
app.post('/api/5s/auditorias/bulk-delete', async (req, res) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Informe um array "ids" com pelo menos 1 id.' });
    }

    const result = await Auditoria5S.deleteMany({ _id: { $in: ids } });
    return res.json({ ok: true, deletedCount: result.deletedCount || 0 });
  } catch (err) {
    console.error('Erro ao excluir auditorias 5S (bulk):', err);
    return res.status(500).json({ error: 'Erro ao excluir auditorias 5S (bulk).' });
  }
});


// BAIXA DE DESVIO NC (5S)
app.post('/api/5s/auditorias/:id/itens/:itemId/desvios/:index/baixa', upload5S.single('foto'), async (req, res) => {
  try {
    const { id, itemId, index } = req.params;
    const idx = Number(index);

    const responsavelCorrecao =
      req.body.responsavelCorrecao ||
      req.body.responsavel ||
      '';

    const comentario =
      req.body.comentario ||
      '';

    if (!responsavelCorrecao) {
      return res.status(400).json({ error: 'Responsável pela correção é obrigatório.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Foto da correção é obrigatória.' });
    }

    const auditoria = await Auditoria5S.findById(id);
    if (!auditoria) {
      return res.status(404).json({ error: 'Auditoria não encontrada.' });
    }

    const item = auditoria.itens.find(i => String(i.itemId) === String(itemId));
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado na auditoria.' });
    }

    if (!Array.isArray(item.desvios) || !item.desvios[idx]) {
      return res.status(404).json({ error: 'Desvio não encontrado.' });
    }

    const desvio = item.desvios[idx];

desvio.status = "BAIXADO";
desvio.baixa = {
  responsavelCorrecao,
  comentario,
  dataHora: new Date().toLocaleString('pt-BR'),
  fotosResolucao: [
    {
      public_id: req.file.filename || null,
      secure_url: req.file.path || null,
      url: req.file.path || null,
      original_filename: req.file.originalname || null,
      format: (req.file.mimetype || '').split('/')[1] || null,
      bytes: typeof req.file.size === 'number' ? req.file.size : null,
      resource_type: 'image',

      name: req.file.originalname || null,
      size: typeof req.file.size === 'number' ? req.file.size : null,
      type: req.file.mimetype || null
    }
  ]
};

auditoria.markModified('itens');
await auditoria.save();

    return res.json({
      ok: true,
      message: 'Baixa registrada com sucesso.'
    });

  } catch (err) {
    console.error('Erro ao dar baixa do desvio 5S:', err);
    return res.status(500).json({
      error: 'Falha ao dar baixa.',
      detalhe: err.message
    });
  }
});

// ===================================================================
// ======================= ENVIAR NOTIFICAÇÃO =========================
// ===================================================================
app.post('/enviar', uploadNotificacaoFotos, async (req, res) => {
  try {
    const dados = req.body;

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

    if (req.files && req.files.length) {
      dados.notificacaoFotos = req.files.map(f => f.path || f.filename);
    }

    dados.status       = 'Aberta';
    dados.dataRegistro = new Date();

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
    if (id) filtro._id = id;
    if (status && status !== 'Todos') filtro.status = status;
    if (encarregado) filtro.encarregado = new RegExp(encarregado, 'i');
    if (tecnico) filtro.tecnico = new RegExp(tecnico, 'i');
    if (area) filtro.area = new RegExp(area, 'i');

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

// APROVAR / REJEITAR / EXCLUIR
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

// =========================== PDF (PDFKIT) ============================
app.get('/notificacoes/:id/pdf', async (req, res) => {
  try {
    const n = await Notificacao.findById(req.params.id);
    if (!n) return res.status(404).send('Notificação não encontrada.');

    // Normalização:
    const tecnicoResp = n.tecnico || '—';
    const encarregado = n.encarregado || '—';
    const supervisor =
      n.supervisorObra ||
      n.supervisor ||
      n.supervisor_da_obra ||
      n.supervisor_obra ||
      '—';

    const squadArea = n.area || n.Squad || n.squad || '—';

    const dataNotificacao = n.dataRegistro
      ? new Date(n.dataRegistro).toLocaleString('pt-BR')
      : '—';

    const prazoResolucao = n.prazo
      ? new Date(n.prazo).toLocaleDateString('pt-BR')
      : '—';

    const nrRel = n.nr || '—';

    const descricaoAtividade =
      n.descricaoAtividade ||
      n.descricao_atividade ||
      n.atividade ||
      '—';

    const descricaoRisco =
      n.descricao ||
      n.condicaoRisco ||
      n.descricaoRisco ||
      '—';

    const acoesRecomendadas =
      n.acoesRecomendadas ||
      n.acaoRecomendada ||
      n.acoes ||
      n.acao ||
      '—';

    const fotosNotificacao = Array.isArray(n.notificacaoFotos)
      ? n.notificacaoFotos
      : [];

    const viewData = {
      id: n.idSequencial != null ? n.idSequencial : n._id,
      classificacao: n.classificacao || '—',
      tecnicoResp,
      encarregado,
      supervisor,
      dataNotificacao,
      squadArea,
      descricaoAtividade,
      descricaoRisco,
      nrRel,
      acoesRecomendadas,
      prazoResolucao,
      fotosNotificacao
    };

    // PDF headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=notificacao_${viewData.id}.pdf`
    );

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    const pageWidth  = doc.page.width;
    const left       = doc.page.margins.left;
    const right      = pageWidth - doc.page.margins.right;
    const contentW   = right - left;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    let y = doc.page.margins.top;

    // LOGO
    try {
      const logoPath = path.join(__dirname, 'public', 'img', 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, left, y, { width: 100 });
      }
    } catch (eLogo) {}

    // Título
    doc
      .fontSize(18)
      .fillColor('#000')
      .text('REGISTRO DE NOTIFICAÇÃO', left, y, {
        width: contentW,
        align: 'center'
      });

    y += 35;

    // Linha
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .stroke('#2E7D32');

    y += 12;

    doc
      .fontSize(12)
      .fillColor('#000')
      .text(`ID: ${viewData.id}`, left, y, {
        width: contentW,
        align: 'center'
      });

    y += 18;

    doc
      .fontSize(10)
      .fillColor('#2E7D32')
      .text(`Classificação: ${viewData.classificacao}`, left, y, {
        width: contentW,
        align: 'center'
      });

    y += 20;

    // Helper
    function drawInfoBox(x, y, width, label, value) {
      const boxHeight = 40;

      doc
        .fillColor('#FAFAFA')
        .rect(x, y, width, boxHeight)
        .fill();

      doc
        .fillColor('#2E7D32')
        .rect(x, y, 3, boxHeight)
        .fill();

      doc
        .strokeColor('#C8E6C9')
        .rect(x, y, width, boxHeight)
        .stroke();

      doc
        .fillColor('#2E7D32')
        .fontSize(9)
        .text(label.toUpperCase(), x + 8, y + 4);

      doc
        .fillColor('#000')
        .fontSize(11)
        .text(value || '—', x + 8, y + 18);

      return y + boxHeight;
    }

    function drawFullBlock(title, textVal) {
      doc
        .fillColor('#2E7D32')
        .fontSize(11)
        .text(title.toUpperCase(), left, y);

      y = doc.y + 2;

      const boxTop = y;
      const padding = 8;
      const maxWidth = contentW - padding * 2 - 3;

      doc
        .fillColor('#000')
        .fontSize(11)
        .text(textVal || '—', left + padding + 3, boxTop + padding, {
          width: maxWidth,
          align: 'justify'
        });

      const boxBottom = doc.y + padding;
      const boxHeight = boxBottom - boxTop;

      doc
        .fillColor('#FFF')
        .rect(left, boxTop, contentW, boxHeight)
        .fill();

      doc
        .fillColor('#2E7D32')
        .rect(left, boxTop, 3, boxHeight)
        .fill();

      doc
        .strokeColor('#C8E6C9')
        .rect(left, boxTop, contentW, boxHeight)
        .stroke();

      doc
        .fillColor('#000')
        .fontSize(11)
        .text(textVal || '—', left + padding + 3, boxTop + padding, {
          width: maxWidth,
          align: 'justify'
        });

      y = boxBottom + 8;
    }

    const gap = 8;
    const colW = (contentW - gap) / 2;

    // Blocos
    let rowY = y;
    rowY = drawInfoBox(left, rowY, colW, 'Técnico Responsável', viewData.tecnicoResp);
    drawInfoBox(left + colW + gap, y, colW, 'Prazo para Resolução', viewData.prazoResolucao);
    y = rowY + 10;

    rowY = y;
    rowY = drawInfoBox(left, rowY, colW, 'Data da Notificação', viewData.dataNotificacao);
    drawInfoBox(left + colW + gap, y, colW, 'NR Relacionada', viewData.nrRel);
    y = rowY + 10;

    rowY = y;
    rowY = drawInfoBox(left, rowY, colW, 'Encarregado Responsável', viewData.encarregado);
    drawInfoBox(left + colW + gap, y, colW, 'Supervisor da Obra', viewData.supervisor);
    y = rowY + 10;

    drawFullBlock('Squad (Área)', viewData.squadArea);
    drawFullBlock('Descrição da Atividade', viewData.descricaoAtividade);
    drawFullBlock('Descrição da Condição de Risco', viewData.descricaoRisco);
    drawFullBlock('Ações Recomendadas', viewData.acoesRecomendadas);

    // Fotos 2 por linha
    if (viewData.fotosNotificacao && viewData.fotosNotificacao.length) {

      if (y + 60 > bottomLimit) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      doc
        .fillColor('#2E7D32')
        .fontSize(13)
        .text('EVIDÊNCIAS FOTOGRÁFICAS DO DESVIO', left, y, {
          width: contentW,
          align: 'center'
        });

      y += 20;

      const photoGap = 10;
      let photoColW = (contentW - photoGap) / 2;
      const photoH = 170;

      let x = left;
      let currentY = y;
      let colIndex = 0;

      for (const foto of viewData.fotosNotificacao) {
        if (currentY + photoH > bottomLimit) {
          doc.addPage();
          x = left;
          currentY = doc.page.margins.top;
          colIndex = 0;
        }

        doc
          .strokeColor('#D0D0D0')
          .rect(x, currentY, photoColW, photoH)
          .stroke();

        try {
          if (foto.startsWith('http')) {
            const buffer = await fetchImageBuffer(foto);
            doc.image(buffer, x + 2, currentY + 2, {
              fit: [photoColW - 4, photoH - 4]
            });
          } else {
            const imgPath = path.join(__dirname, 'uploads', foto);
            if (fs.existsSync(imgPath)) {
              doc.image(imgPath, x + 2, currentY + 2, {
                fit: [photoColW - 4, photoH - 4]
              });
            }
          }
        } catch {}

        if (colIndex === 0) {
          x += photoColW + photoGap;
          colIndex = 1;
        } else {
          x = left;
          currentY += photoH + photoGap;
          colIndex = 0;
        }
      }
    }

    doc.end();
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    if (!res.headersSent) {
      res.status(500).send('Erro ao gerar PDF.');
    }
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
        fotos[f.fieldname].push(f.path || f.filename);
      });

      const novaInspecao = await Inspecao.create({
        funcionario:  req.body.funcionario,
        dataInspecao: new Date(req.body.dataInspecao),
        equipamento:  req.body.equipamento,
        respostas,
        fotos,
        desvioExtra:  req.body.desvioExtra || ''
      });

      res.send('Inspeção registrada com sucesso!');
    } catch (err) {
      console.error('Erro ao processar inspeção:', err);
      res.status(500).send('Erro ao registrar inspeção.');
    }
  }
);

// ============================ START ================================
// ============================ START ================================
startServer();
