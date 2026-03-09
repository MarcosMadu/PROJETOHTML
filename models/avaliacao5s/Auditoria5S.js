const mongoose = require("mongoose");

/**
 * Arquivo / foto
 */
const CloudFileSchema = new mongoose.Schema(
  {
    public_id: { type: String, default: null },
    secure_url: { type: String, default: null },
    url: { type: String, default: null },

    original_filename: { type: String, default: null },
    format: { type: String, default: null },
    bytes: { type: Number, default: null },
    resource_type: { type: String, default: "image" },

    // compatibilidade com docs antigos
    name: { type: String, default: null },
    size: { type: Number, default: null },
    type: { type: String, default: null },
  },
  { _id: false }
);

const BaixaSchema = new mongoose.Schema(
  {
    responsavelCorrecao: { type: String, default: null },
    comentario: { type: String, default: null },
    dataHora: { type: String, default: null },
    fotosResolucao: {
      type: [CloudFileSchema],
      default: [],
    },
  },
  { _id: false }
);

const DesvioSchema = new mongoose.Schema(
  {
    responsavel: { type: String, required: true },

    foto: {
      type: CloudFileSchema,
      required: true,
    },

    status: {
      type: String,
      enum: ["ABERTO", "BAIXADO", "VENCIDO"],
      default: "ABERTO",
    },

    baixa: {
      type: BaixaSchema,
      default: () => ({
        responsavelCorrecao: null,
        comentario: null,
        dataHora: null,
        fotosResolucao: [],
      }),
    },
  },
  { _id: false }
);

const ItemSchema = new mongoose.Schema(
  {
    itemId: { type: Number, required: true },
    grupo: { type: String, required: true },
    texto: { type: String, required: true },

    status: {
      type: String,
      enum: ["C", "NC", "NA"],
      required: true,
    },

    naJustificativa: { type: String, default: null },

    conformeFotos: {
      type: [CloudFileSchema],
      default: [],
    },

    desvios: {
      type: [DesvioSchema],
      default: [],
    },
  },
  { _id: false }
);

const Auditoria5SSchema = new mongoose.Schema(
  {
    semanaId: { type: String, required: true },

    // compatibilidade com o que já existe
    auditorSemana: { type: String, required: true },

    // novos campos
    auditorProgramado: { type: String, default: null },
    auditorRealizador: { type: String, default: null },

    dataHora: { type: String, required: true },

    setor: { type: String, default: null },
    local: { type: String, default: null },

    tipoAuditoria: { type: String, default: null },
    maturidade: { type: Number, default: null },

    itens: { type: [ItemSchema], required: true },
  },
  {
    collection: "auditorias_5s",
    timestamps: true,
  }
);

module.exports = mongoose.model("Auditoria5S", Auditoria5SSchema);
