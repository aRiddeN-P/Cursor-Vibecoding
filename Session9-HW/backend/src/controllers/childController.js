const childModel = require('../models/child');
const childService = require('../services/childService');

function formatChild(child) {
  return {
    id: child.id,
    user_id: child.user_id,
    name: child.name,
    birth_date: child.birth_date,
    age_group: child.age_group,
    created_at: child.created_at,
  };
}

function listChildren(req, res) {
  const children = childModel.getByUserId(req.userId);
  res.json({ success: true, children: children.map(formatChild) });
}

function createChild(req, res) {
  const { name, birth_date } = req.body;
  const validation = childService.validateChildInput(name, birth_date);

  if (validation.error) {
    return res.status(validation.status).json({ success: false, message: validation.error });
  }

  const child = childModel.createChild(
    req.userId,
    validation.name,
    validation.birthDate,
    validation.ageGroup
  );

  res.status(201).json({ success: true, child: formatChild(child) });
}

module.exports = { listChildren, createChild };
