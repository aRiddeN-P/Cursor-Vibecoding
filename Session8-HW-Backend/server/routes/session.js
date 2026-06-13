'use strict';

const express = require('express');
const ctrl = require('../controllers/sessionController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();

router.post('/ping', requireUser, ctrl.ping);

module.exports = router;
