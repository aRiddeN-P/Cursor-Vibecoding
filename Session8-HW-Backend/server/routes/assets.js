'use strict';

const express = require('express');
const ctrl = require('../controllers/assetsController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.use(requireUser);

router.get('/types', ctrl.listTypesEndpoint);
router.get('/history', ctrl.historyEndpoint);
router.get('/net-worth', ctrl.netWorthEndpoint);
router.get('/', ctrl.listAssetsEndpoint);
router.post('/', ctrl.createAssetEndpoint);
router.patch('/:id', ctrl.patchAssetEndpoint);
router.delete('/:id', ctrl.deleteAssetEndpoint);

module.exports = router;
