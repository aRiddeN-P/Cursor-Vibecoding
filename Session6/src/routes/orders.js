const express = require('express');
const { findDishByCode } = require('../data/menu');
const { findMemberByCode } = require('../data/members');
const { hasOrder, placeOrder, getOrder, updateOrder } = require('../data/orders');

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const { memberCode, dishCode } = req.body || {};

    if (!memberCode || !dishCode) {
      return res.status(400).json({
        message: 'memberCode and dishCode are required in the request body',
      });
    }

    const member = findMemberByCode(memberCode);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const dish = findDishByCode(dishCode);
    if (!dish) {
      return res.status(400).json({ message: 'Invalid dish code' });
    }

    if (hasOrder(memberCode)) {
      return res.status(400).json({ message: 'Member has already placed an order' });
    }

    dish.orderCount += 1;
    placeOrder(memberCode, dishCode);

    res.status(201).json({
      message: 'Order placed successfully',
      order: {
        memberCode: member.memberCode,
        memberName: member.name,
        dishCode: dish.dishCode,
        dishName: dish.name,
        category: dish.category,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:memberCode', (req, res, next) => {
  try {
    const { memberCode } = req.params;
    const { dishCode } = req.body || {};

    if (!dishCode) {
      return res.status(400).json({
        message: 'dishCode is required in the request body',
      });
    }

    const member = findMemberByCode(memberCode);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const existingOrder = getOrder(memberCode);
    if (!existingOrder) {
      return res.status(404).json({ message: 'No existing order found for this member' });
    }

    const newDish = findDishByCode(dishCode);
    if (!newDish) {
      return res.status(400).json({ message: 'Invalid dish code' });
    }

    const oldDish = findDishByCode(existingOrder.dishCode);
    if (oldDish) {
      oldDish.orderCount -= 1;
    }

    newDish.orderCount += 1;
    updateOrder(memberCode, dishCode);

    res.status(200).json({
      message: 'Order updated successfully',
      order: {
        memberCode: member.memberCode,
        memberName: member.name,
        previousDish: oldDish ? oldDish.name : existingOrder.dishCode,
        newDishCode: newDish.dishCode,
        newDishName: newDish.name,
        category: newDish.category,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
