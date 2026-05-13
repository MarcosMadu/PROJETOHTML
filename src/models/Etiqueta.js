// src/models/Etiqueta.js
const mongoose = require('mongoose');

const etiquetaSchema = new mongoose.Schema({
  numero: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['Disponível', 'Utilizada'],
    default: 'Disponível'
  },
  funcionario: {
    type: String,
    default: 'Não informado'
  },
  data: String,
  hora: String,
  observacao: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Etiqueta', etiquetaSchema);
