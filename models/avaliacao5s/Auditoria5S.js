const mongoose = require("mongoose");

const DesvioSchema = new mongoose.Schema(
  {
    responsavel: { type: String, required: true },
    foto: {
      name: String,
      size: Number,
      type: String,
    },

    status: {
      type: String,
      enum: ["ABERTO", "BAIXADO", "VENCIDO"],
      default: "ABERTO",
    },

    baixa: {
      fotosResolucao: [{ name: String, size: Number, type: String }],
      dataHora: { type: String, default: null },
    },
  },
  { _id: false }
);

const ItemSchema = new mongoose.Schema(
  {
    itemId: { type: Number, required: true },
    grupo: { type: String, required: true },
    texto: { type: String, required: true },

    status: { type: String, enum: ["C", "NC", "NA"], required: true },

    naJustificativa: { type: String, default: null },

    conformeFotos: [{ name: String, size: Number, type: String }],

    desvios: { type: [DesvioSchema], default: [] },
  },
  { _id: false }
);

const Auditoria5SSchema = new mongoose.Schema(
  {
    semanaId: { type: String, required: true },
    auditorSemana: { type: String, required: true },
    dataHora: { type: String, required: true },

    setor: { type: String, default: null },

    itens: { type: [ItemSchema], required: true },
  },
  {
    collection: "auditorias_5s",
    timestamps: true, // cria createdAt e updatedAt automaticamente
  }
);

module.exports = mongoose.model("Auditoria5S", Auditoria5SSchema);
