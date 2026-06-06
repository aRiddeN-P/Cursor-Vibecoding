const express = require('express');
const { getMenu } = require('../data/menu');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getMenu());
});

module.exports = router;
