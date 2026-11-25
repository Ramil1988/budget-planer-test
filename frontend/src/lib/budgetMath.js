// Figures behind the Budget page that are worth getting right once: where the month stands,
// how spending compares with the calendar, and how categories are grouped.

// Where `today` falls in the selected month ('YYYY-MM').
export function monthProgress(selectedMonth, today = new Date()) {
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrent = today.getFullYear() === year && today.getMonth() + 1 === month;
  const isPast = !isCurrent && new Date(year, month - 1, 1) < today;
  const day = isCurrent ? today.getDate() : isPast ? daysInMonth : 0;
  return {
    state: isCurrent ? 'current' : isPast ? 'past' : 'future',
    day,
    daysInMonth,
    daysLeft: daysInMonth - day,
    elapsed: day / daysInMonth,
  };
}

// 'none' has no limit; 'close' is the last fifth of the limit.
export function categoryStatus({ limit, spent }) {
  if (!(limit > 0)) return 'none';
  if (spent > limit) return 'over';
  return spent / limit > 0.8 ? 'close' : 'ok';
}

const GROUP_ORDER = ['over', 'close', 'ok', 'none'];

// Categories in the order they need attention, as non-empty groups.
export function groupCategories(items) {
  const groups = new Map(GROUP_ORDER.map((status) => [status, []]));
  for (const item of items) groups.get(categoryStatus(item)).push(item);
  return GROUP_ORDER
    .map((status) => ({ status, items: groups.get(status) }))
    .filter((group) => group.items.length > 0);
}

// One sentence on how the month is going, and one on what that leaves.
// `scheduled` is what recurring payments will still take this month.
export function paceSummary({ limit, spent, scheduled = 0, progress, monthName, money }) {
  const remaining = limit - spent;
  if (!(limit > 0)) {
    return {
      tone: 'neutral',
      headline: 'No limits set for this month',
      detail: spent > 0 ? `${money(spent)} spent so far. Set limits in Budget Setup to track it.` : 'Set limits in Budget Setup to start tracking.',
    };
  }
  if (progress.state === 'past') {
    return remaining >= 0
      ? { tone: 'good', headline: `${monthName} closed ${money(remaining)} under budget`, detail: `${money(spent)} spent of ${money(limit)}.` }
      : { tone: 'bad', headline: `${monthName} closed ${money(-remaining)} over budget`, detail: `${money(spent)} spent of ${money(limit)}.` };
  }
  if (progress.state === 'future') {
    return {
      tone: 'neutral',
      headline: `${monthName} has not started`,
      detail: scheduled > 0 ? `${money(scheduled)} is already scheduled in recurring payments.` : 'Nothing is scheduled yet.',
    };
  }

  const days = Math.max(progress.daysLeft, 1);
  const dayWord = days === 1 ? 'day' : 'days';
  if (remaining < 0) {
    return {
      tone: 'bad',
      headline: `Over budget by ${money(-remaining)}`,
      detail: scheduled > 0
        ? `${progress.daysLeft} ${progress.daysLeft === 1 ? 'day' : 'days'} left, and ${money(scheduled)} more is scheduled.`
        : `${progress.daysLeft} ${progress.daysLeft === 1 ? 'day' : 'days'} left in the month.`,
    };
  }

  const used = Math.round((spent / limit) * 100);
  const gone = Math.round(progress.elapsed * 100);
  const ahead = spent - limit * progress.elapsed;
  // Three percent of the budget either way still counts as keeping pace.
  const tolerance = limit * 0.03;
  const free = remaining - scheduled;
  const leaves = free >= 0
    ? `${money(free)} is free after scheduled payments, about ${money(free / days)} a day for ${days} ${dayWord}.`
    : `Scheduled payments need ${money(scheduled)}, which is ${money(-free)} more than what is left.`;
  const pace = `${used}% of the budget used with ${gone}% of the month gone.`;

  if (ahead > tolerance) return { tone: free < 0 ? 'bad' : 'warn', headline: `${money(ahead)} ahead of pace`, detail: `${pace} ${leaves}` };
  if (ahead < -tolerance) return { tone: free < 0 ? 'warn' : 'good', headline: `${money(-ahead)} under pace`, detail: `${pace} ${leaves}` };
  return { tone: free < 0 ? 'warn' : 'good', headline: 'On pace', detail: `${pace} ${leaves}` };
}

// How the planned total is divided: the largest categories, then everything else as one part.
export function allocation(categories, limits, maxParts = 6) {
  const parts = categories
    .map(({ id, name }) => ({ id, name, amount: Number(limits[id] || 0) }))
    .filter(({ amount }) => amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = parts.reduce((sum, { amount }) => sum + amount, 0);
  if (!total) return [];
  const shown = parts.length > maxParts ? parts.slice(0, maxParts - 1) : parts;
  const rest = parts.slice(shown.length);
  const withRest = rest.length
    ? [...shown, { id: 'other', name: `${rest.length} more`, amount: rest.reduce((sum, { amount }) => sum + amount, 0) }]
    : shown;
  return withRest.map((part) => ({ ...part, share: part.amount / total }));
}
