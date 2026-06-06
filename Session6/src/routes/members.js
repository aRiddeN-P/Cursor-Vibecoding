const express = require('express');
const { getMembers } = require('../data/members');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getMembers());
});

module.exports = router;
