// Order statistics shown on the orders page.

function averageOrderValue(orders) {
  const total = orders.reduce((sum, o) => sum + o.amount, 0);
  return total / orders.length;
}

function lastNOrders(orders, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    if (orders[i]) out.push(orders[i]);
  }
  return out;
}

module.exports = { averageOrderValue, lastNOrders };
