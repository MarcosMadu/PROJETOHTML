const mongoose = require("mongoose");

const DesvioSchema = new mongoose.Schema(
  {
    responsavel: { type: String, required: true },
    foto: {
      name: String,
      size: Number,
      type: String,
    },
    status: { type: String, enum: ["ABERTO", "BAIXADO", "VENCIDO"], default: "ABERTO" },
    baixa: {
      fotosResolucao: [{ name: String, size: Number, type: String }],
      dataHora: String,
    },
  },
  { _id: false }
);

const ItemSchema = new mongoose.Schema(
  {
    itemId: { type: Number, required: true },
    grupo: String,
    texto: String,
    status: { type: String, enum: ["C", "NC", "NA"], required: true },
    naJustificativa: String,
    conformeFotos: [{ name: String, size: Number, type: String }],
    desvios: [DesvioSchema],
  },
  { _id: false }
);

const Auditoria5SSchema = new mongoose.Schema(
  {
    semanaId: { type: String, required: true },
    auditorSemana: { type: String, required: true },
    dataHora: { type: String, required: true },
    setor: String,
    itens: [ItemSchema],
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "auditorias_5s" }
);

module.exports = mongoose.model("Auditoria5S", Auditoria5SSchema);
