const mongoose = require('mongoose');

const aptidaoSchema = new mongoose.Schema({
  nome:           { type: String, required: true },
  sentindoBem:    { type: Boolean, required: true },
  bebida:         { type: Boolean, required: true },
  sono:           { type: Boolean, required: true },
  apto:           { type: Boolean, required: true },
  dataRegistro:   { type: Date,    default: Date.now }
}, {
  collection: 'aptidoes'
});

module.exports = mongoose.model('Aptidao', aptidaoSchema);
