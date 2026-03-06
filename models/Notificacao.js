const mongoose = require('mongoose');

const NotificacaoSchema = new mongoose.Schema({
  // ID sequencial amigável (1, 2, 3...)
  idSequencial: { type: Number }, // <<< NÃO OBRIGATÓRIO

  tecnico:            { type: String, required: true },
  encarregado:        String,
  classificacao:      String,
  supervisorObra:     String,
  descricaoAtividade: String,
  area:               String,
  descricao:          String,
  nr:                 String,
  acao:               String,
  prazo:              Date,
  dataRegistro:       { type: Date, default: Date.now },
  status:             { type: String, default: 'Aberta' },

  // Fotos da notificação
  notificacaoFotos:   { type: [String], default: ['Ainda não enviado'] },

  // Dados da baixa
  resolvidoPor:        { type: String, default: 'Ainda não enviado' },
  resolucaoComentario: { type: String, default: 'Ainda não enviado' },
  resolucaoFotos:      { type: [String], default: ['Ainda não enviado'] },
  dataBaixa:           { type: Date, default: null },

  comentarioAprovacao: { type: String, default: '' },
  aprovadoPor:         { type: String },
  dataAprovacao:       { type: Date },

  justificativaRejeicao: String
});

module.exports = mongoose.model('Notificacao', NotificacaoSchema);
