const orders = new Map();

function getOrder(memberCode) {
  return orders.get(memberCode) || null;
}

function hasOrder(memberCode) {
  return orders.has(memberCode);
}

function placeOrder(memberCode, dishCode) {
  orders.set(memberCode, { memberCode, dishCode });
}

function updateOrder(memberCode, dishCode) {
  orders.set(memberCode, { memberCode, dishCode });
}

module.exports = { getOrder, hasOrder, placeOrder, updateOrder };
