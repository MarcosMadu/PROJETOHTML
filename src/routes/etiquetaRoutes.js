const express = require('express');
const router = express.Router();

const Etiqueta = require('../models/Etiqueta');


// ======================================================
// CRIAR AUTOMATICAMENTE AS 1000 ETIQUETAS
// ======================================================

router.get('/init', async (req, res) => {
  try {

    const total = await Etiqueta.countDocuments();

    if (total > 0) {
      return res.json({
        message: 'Etiquetas já cadastradas.',
        total
      });
    }

    const etiquetas = [];

    for (let i = 1; i <= 1000; i++) {
      etiquetas.push({
        numero: `ETQ-${String(i).padStart(4, '0')}`,
        status: 'Disponível'
      });
    }

    await Etiqueta.insertMany(etiquetas);

    res.json({
      message: '1000 etiquetas criadas com sucesso.'
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Erro ao criar etiquetas.'
    });
  }
});


// ======================================================
// LISTAR TODAS AS ETIQUETAS
// ======================================================

router.get('/', async (req, res) => {
  try {

    const etiquetas = await Etiqueta.find().sort({ numero: 1 });

    res.json(etiquetas);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Erro ao buscar etiquetas.'
    });
  }
});


// ======================================================
// REGISTRAR USO DA ETIQUETA
// ======================================================

router.post('/usar', async (req, res) => {

  try {

    const {
      numero,
      funcionario,
      observacao
    } = req.body;

    const etiqueta = await Etiqueta.findOne({ numero });

    if (!etiqueta) {
      return res.status(404).json({
        error: 'Etiqueta não encontrada.'
      });
    }

    if (etiqueta.status === 'Utilizada') {
      return res.status(400).json({
        error: 'Etiqueta já utilizada.'
      });
    }

    const agora = new Date();

    etiqueta.status = 'Utilizada';

    etiqueta.funcionario =
      funcionario || 'Não informado';

    etiqueta.data =
      agora.toLocaleDateString('pt-BR');

    etiqueta.hora =
      agora.toLocaleTimeString('pt-BR');

    etiqueta.observacao =
      observacao || '';

    await etiqueta.save();

    res.json({
      message: 'Etiqueta utilizada com sucesso.',
      etiqueta
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Erro ao registrar uso.'
    });
  }
});


// ======================================================
// HISTÓRICO
// ======================================================

router.get('/historico', async (req, res) => {

  try {

    const historico = await Etiqueta.find({
      status: 'Utilizada'
    }).sort({
      updatedAt: -1
    });

    res.json(historico);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Erro ao buscar histórico.'
    });
  }
});


// ======================================================
// RESETAR TODAS
// ======================================================

router.post('/reset', async (req, res) => {

  try {

    await Etiqueta.updateMany(
      {},
      {
        $set: {
          status: 'Disponível',
          funcionario: '',
          data: '',
          hora: '',
          observacao: ''
        }
      }
    );

    res.json({
      message: 'Etiquetas resetadas.'
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Erro ao resetar etiquetas.'
    });
  }
});

module.exports = router;
