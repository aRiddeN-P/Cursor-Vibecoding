'use strict';

/**
 * Calculate net balances per member from expenses (+ settlements).
 * Positive balance = others owe this member (creditor).
 * Negative balance = this member owes others (debtor).
 */
function calculateBalances(members, expenses, settlements) {
  const balances = {};
  for (const m of members) {
    balances[m.id] = 0;
  }

  for (const exp of expenses) {
    if (exp.is_deleted) continue;
    const paidBy = exp.paid_by_member_id;
    if (balances[paidBy] != null) {
      balances[paidBy] += Math.round(Number(exp.amount) || 0);
    }
    const shares = exp.shares || [];
    for (const sh of shares) {
      if (balances[sh.member_id] != null) {
        balances[sh.member_id] -= Math.round(Number(sh.share_amount) || 0);
      }
    }
  }

  for (const s of settlements || []) {
    const amt = Math.round(Number(s.amount) || 0);
    if (balances[s.from_member_id] != null) balances[s.from_member_id] += amt;
    if (balances[s.to_member_id] != null) balances[s.to_member_id] -= amt;
  }

  return balances;
}

/**
 * Greedy minimum-cash-flow settlement suggestions.
 * balances: { memberId: netBalance } — positive = owed to, negative = owes
 */
function calculateMinimumSettlements(balances) {
  const creditors = [];
  const debtors = [];

  for (const [id, bal] of Object.entries(balances)) {
    const rounded = Math.round(Number(bal) || 0);
    if (rounded > 0) creditors.push({ id: Number(id), amount: rounded });
    if (rounded < 0) debtors.push({ id: Number(id), amount: -rounded });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const settle = Math.min(debtors[i].amount, creditors[j].amount);
    if (settle > 0) {
      settlements.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: settle,
      });
    }
    debtors[i].amount -= settle;
    creditors[j].amount -= settle;
    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }

  return settlements;
}

/**
 * Divide amount equally; remainder goes to payer (per Phase 12 spec).
 */
function equalShares(memberIds, totalAmount, payerMemberId) {
  const n = memberIds.length;
  if (!n) return [];
  const total = Math.round(Number(totalAmount) || 0);
  const base = Math.floor(total / n);
  let remainder = total - base * n;
  const shares = memberIds.map((mid) => ({
    member_id: mid,
    share_amount: base,
  }));
  if (remainder > 0) {
    const idx = shares.findIndex((s) => s.member_id === payerMemberId);
    const target = idx >= 0 ? idx : 0;
    shares[target].share_amount += remainder;
  }
  return shares;
}

module.exports = {
  calculateBalances,
  calculateMinimumSettlements,
  equalShares,
};
