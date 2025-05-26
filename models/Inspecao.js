const mongoose = require('mongoose');

const inspecaoSchema = new mongoose.Schema({
  funcionario:    { type: String,   required: true },
  dataInspecao:   { type: Date,     required: true },
  equipamento:    { type: String,   required: true },
  // respostas do checklist (resposta1 ... resposta19)
  respostas:      { type: Map, of: String, required: true },
  // nomes dos campos de foto serão "foto1", "foto2", ..., "foto19"
  fotos:          { type: Map, of: [String], default: {} },
  desvioExtra:    { type: String,   default: '' },
  dataRegistro:   { type: Date,     default: Date.now }
}, {
  collection: 'inspecoes'
});

module.exports = mongoose.model('Inspecao', inspecaoSchema);
