'use strict';

const express = require('express');
const ctrl = require('../controllers/marketController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.use(requireUser);

router.get('/gold-currency', ctrl.goldCurrencyEndpoint);
router.get('/crypto', ctrl.cryptoEndpoint);
router.get('/commodity', ctrl.commodityEndpoint);
router.get('/all', ctrl.allEndpoint);
router.get('/favorites', ctrl.listFavoritesEndpoint);
router.post('/favorites', ctrl.addFavoriteEndpoint);
router.delete('/favorites/:symbol', ctrl.deleteFavoriteEndpoint);
router.patch('/favorites/:symbol/pin', ctrl.pinFavoriteEndpoint);

module.exports = router;
