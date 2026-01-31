const mongoose = require("mongoose");

/**
 * Foto padrão (metadados do arquivo)
 * OBS: por enquanto você está salvando só {name,size,type}.
 * Quando evoluirmos, dá pra trocar para URL (Cloudinary) + public_id.
 */
const CloudFileSchema = new mongoose.Schema(
  {
    // Cloudinary
    public_id: { type: String, default: null },
    secure_url: { type: String, default: null }, // ✅ use essa no front
    url: { type: String, default: null },

    // metadados úteis
    original_filename: { type: String, default: null },
    format: { type: String, default: null },
    bytes: { type: Number, default: null },
    resource_type: { type: String, default: "image" },

    // compatibilidade com seu formato antigo (não quebra docs velhos)
    name: { type: String, default: null },
    size: { type: Number, default: null },
    type: { type: String, default: null },
  },
  { _id: false }
);


const DesvioSchema = new mongoose.Schema(
  {
    responsavel: { type: String, required: true },

    // ✅ IMPORTANTE: deve ser OBJETO tipado (não “subdocumento solto”)
    // Isso evita CastError quando chega {name,size,type}
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
      // ✅ Array de objetos tipados
      fotosResolucao: {
        type: [CloudFileSchema],
        default: [],
      },
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

    // ✅ Array de objetos tipados (evita CastError)
    conformeFotos: {
      type: [CloudFileSchema],
      default: [],
    },

    // NC: vários desvios
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
    auditorSemana: { type: String, required: true },
    dataHora: { type: String, required: true },

    setor: { type: String, default: null },

    itens: { type: [ItemSchema], required: true },
  },
  {
    collection: "auditorias_5s",
    timestamps: true, // createdAt e updatedAt
  }
);

module.exports = mongoose.model("Auditoria5S", Auditoria5SSchema);
