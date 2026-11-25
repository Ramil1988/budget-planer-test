import { groupCategories } from '../../lib/budgetMath';
import RecurringBadge from './RecurringBadge';

const width = (amount, limit) => `${Math.max(0, Math.min(amount / limit, 1)) * 100}%`;
const count = (items) => `${items.length} ${items.length === 1 ? 'category' : 'categories'}`;
const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);

const HEADINGS = {
  over: 'Over budget',
  close: 'Close to the limit',
  ok: 'On track',
  none: 'No limit set',
  exceed: 'Will go over',
  fit: 'Will fit',
};

// How far past its limit a category is, drawn beyond the end of its meter. The room for it is
// a fifth of the meter, which stands for going over by the whole limit or more.
const overrun = (amount, limit) => `${Math.min(amount / limit, 1) * 20}%`;

function Row({ item, status, parts, over = 0, amounts, left, due, today, recurring, onOpen }) {
  return (
    <li className="budget-row" data-status={status}>
      <span className="budget-row__name">
        <button type="button" className="budget-row__open" onClick={() => onOpen(item)}>{item.name}</button>
        <RecurringBadge info={recurring} />
      </span>
      <span className="budget-row__bar">
        {item.limit > 0 && (
          <span className="budget-meter" style={{ display: 'block' }} role="img" aria-label={`${Math.round(item.percentOfLimit)}% used`}>
            <span className="budget-meter__bar">
              {parts.map(([part, amount]) => amount > 0 && (
                <span className="budget-part" data-part={part} style={{ width: width(amount, item.limit) }} key={part} />
              ))}
            </span>
            {over > 0 && (
              <span
                className="budget-meter__over"
                style={{ width: overrun(over, item.limit) }}
                title={`${Math.round((over / item.limit) * 100)}% past the limit`}
              />
            )}
            {today != null && <span className="budget-meter__today" style={{ left: `${today * 100}%` }} />}
          </span>
        )}
      </span>
      <span className="budget-row__amounts">{amounts}</span>
      <span className="budget-row__left">{left}</span>
      {due && <p className="budget-row__due">{due}</p>}
    </li>
  );
}

// Categories as ledger rows, grouped by how much attention they need. Every meter runs from
// zero to the category's own limit, so the mark for today falls at the same place on each.
export default function CategoryList({ mode, items, progress, recurringByCategory, formatCurrency, onOpen, search }) {
  // A projected meter runs to the end of the month, so a mark for today says nothing on it.
  const today = mode === 'current' && progress.state === 'current' ? progress.elapsed : null;

  if (items.length === 0) {
    return (
      <div className="bw-panel">
        <p className="bw-nothing">{search ? `No categories match “${search}”.` : 'No categories to show for this month.'}</p>
      </div>
    );
  }

  if (mode === 'projected') {
    const groups = [
      { status: 'exceed', items: items.filter((item) => item.willExceed) },
      { status: 'fit', items: items.filter((item) => !item.willExceed) },
    ].filter((group) => group.items.length > 0);

    return (
      <div className="bw-panel">
        {groups.map((group) => (
          <section className="bw-group" data-status={group.status === 'exceed' ? 'over' : 'ok'} key={group.status}>
            <header className="bw-group__head">
              <h3>{HEADINGS[group.status]}</h3>
              <span>
                {count(group.items)}
                {group.status === 'exceed' && `, ${formatCurrency(sum(group.items, (item) => item.overAmount))} over in total`}
              </span>
            </header>
            <ul className="bw-rows">
              {group.items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  status={item.willExceed ? 'over' : 'ok'}
                  parts={[['spent', item.spent], ['scheduled', item.upcomingAmount], ['expected', item.nonRecurringRemaining]]}
                  over={item.overAmount}
                  amounts={<><b>{formatCurrency(item.projectedSpent)}</b> of {formatCurrency(item.limit)}</>}
                  left={item.willExceed
                    ? `${formatCurrency(item.overAmount)} over`
                    : item.projectedRemaining > 0.004 ? `${formatCurrency(item.projectedRemaining)} left` : 'Uses the limit'}
                  due={item.upcomingPayments.length > 0 && `Still due: ${item.upcomingPayments
                    .map((payment) => `${payment.name} ${formatCurrency(payment.total)}${payment.occurrences > 1 ? ` (×${payment.occurrences})` : ''}`)
                    .join(', ')}`}
                  today={today}
                  recurring={recurringByCategory[item.id]}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  const summaries = {
    over: (group) => `${formatCurrency(sum(group, (item) => item.spent - item.limit))} over in total`,
    close: (group) => `${formatCurrency(sum(group, (item) => item.remaining))} left`,
    ok: (group) => `${formatCurrency(sum(group, (item) => item.remaining))} left`,
    none: (group) => `${formatCurrency(sum(group, (item) => item.spent))} spent`,
  };

  return (
    <div className="bw-panel">
      {groupCategories(items).map((group) => (
        <section className="bw-group" data-status={group.status} key={group.status}>
          <header className="bw-group__head">
            <h3>{HEADINGS[group.status]}</h3>
            <span>{count(group.items)}, {summaries[group.status](group.items)}</span>
          </header>
          <ul className="bw-rows">
            {group.items.map((item) => (
              <Row
                key={item.id}
                item={item}
                status={group.status}
                parts={[['spent', item.spent]]}
                over={item.spent - item.limit}
                amounts={item.limit > 0
                  ? <><b>{formatCurrency(item.spent)}</b> of {formatCurrency(item.limit)}</>
                  : <><b>{formatCurrency(item.spent)}</b> spent</>}
                left={item.limit > 0
                  ? `${formatCurrency(Math.abs(item.remaining))} ${item.remaining < 0 ? 'over' : 'left'}`
                  : 'No limit'}
                today={today}
                recurring={recurringByCategory[item.id]}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
