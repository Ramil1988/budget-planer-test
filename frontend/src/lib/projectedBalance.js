// The forecast card starts at zero unless the user enters another opening balance.
export function projectionAtOpening(projection, startingCents = 0) {
  if (!Number.isFinite(projection?.startingBalance) || !Array.isArray(projection.days)) return null;
  const offset = startingCents - Math.round(projection.startingBalance * 100);
  const days = projection.days.filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day?.date) && Number.isFinite(day.balance))
    .map((day) => ({ ...day, balance: (Math.round(day.balance * 100) + offset) / 100 }));
  if (!days.length) return null;
  const firstNegative = days.find(({ balance }) => balance < 0);
  const lowest = days.reduce((minimum, day) => day.balance < minimum.balance ? day : minimum);
  const topUpCents = Math.max(0, -startingCents, -Math.round(lowest.balance * 100));
  const topUpDate = startingCents < 0 ? days[0].date : firstNegative?.date;
  return { days, firstNegative, lowest, topUpCents, topUpDate };
}
