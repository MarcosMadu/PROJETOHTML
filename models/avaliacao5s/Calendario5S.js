const mongoose = require("mongoose");

const Calendario5SSchema = new mongoose.Schema(
  {
    semanaId: {
      type: String,
      required: true,
      trim: true
    },
    dataInicio: {
      type: String,
      default: null
    },
    dataFim: {
      type: String,
      default: null
    },
    local: {
      type: String,
      required: true,
      trim: true
    },
    responsavel: {
      type: String,
      required: true,
      trim: true
    },
    tipoAuditoria: {
      type: String,
      default: "Ambos",
      enum: ["Administrativa", "Campo", "Ambos"]
    },
    observacoes: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    collection: "calendario_5s"
  }
);

Calendario5SSchema.index(
  { semanaId: 1, local: 1, tipoAuditoria: 1 },
  { unique: true }
);

module.exports = mongoose.model("Calendario5S", Calendario5SSchema);
