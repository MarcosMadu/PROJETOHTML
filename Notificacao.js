const mongoose = require('mongoose');

const notificacaoSchema = new mongoose.Schema({
  supervisorObra:      { type: String, default: '-' },
  descricaoAtividade:  { type: String, default: '-' },
  tecnico:             { type: String, required: true },
  encarregado:         { type: String, required: true },
  classificacao:       { type: String, required: true },
  area:                { type: String, required: true },
  descricao:           { type: String, required: true },
  nr:                  { type: String, required: true },
  acao:                { type: String, required: true },
  prazo:               { type: Date,   required: true },
  status:              { type: String, default: 'Aberta' },
  dataRegistro:        { type: Date,   default: Date.now },
  caminhoPDF:          String,

  // 🔹 Fotos da notificação (antes da baixa) — agora aceitando URLs (Cloudinary ou caminho local)
  notificacaoFotos:    { type: [String], default: [] },

  // Campos de resolução (baixa)
  resolvidoPor:        { type: String, default: 'Ainda não enviado' },
  resolucaoComentario: { type: String, default: 'Ainda não enviado' },
  resolucaoFotos:      { type: [String], default: [] },
  dataBaixa:           { type: Date,     default: null },

  justificativaRejeicao: String

}, {
  collection: 'notificacoes_v2'   // <-- nome da nova coleção
});

module.exports = mongoose.model('NotificacaoV2', notificacaoSchema);
