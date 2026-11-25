import { LuTrash2 } from 'react-icons/lu';
import { dayHeading } from '../../lib/transactionView';

// The transactions in view, newest first, under a heading for each day. The category and
// the amount of a row can be changed in place. Takes the groups of groupByDay.
//
// `category` and `amount` carry what is being edited and the handlers for it:
//   category: { editingId, busy, options, onStart(id), onCancel(), onSelect(transaction, categoryId) }
//   amount:   { editingId, value, onStart(transaction), onChange(value), onCommit(id, value), onCancel() }
export default function TransactionList({ groups, category, amount, onTrash, formatAmount, formatMoney }) {
  return (
    <div className="bw-panel tx-list">
      {groups.map((group) => (
        <section className="tx-day" key={group.date}>
          <header className="tx-day__head">
            <h3>{dayHeading(group.date)}</h3>
            <span>
              {group.items.length} {group.items.length === 1 ? 'transaction' : 'transactions'},{' '}
              <b data-tone={group.net > 0 ? 'good' : undefined}>{group.net > 0 ? '+' : group.net < 0 ? '−' : ''}{formatMoney(Math.abs(group.net))}</b>
            </span>
            <span className="tx-day__sofar">{formatMoney(group.spentSoFar)} spent so far</span>
          </header>
          <ul className="bw-rows tx-rows">
            {group.items.map((transaction) => {
              const name = transaction.description || transaction.category;
              return (
                <li className="tx-row" data-type={transaction.type} key={transaction.id}>
                  <div className="tx-row__body">
                    <p className="tx-row__name">{name}</p>
                    <div className="tx-row__meta">
                      {category.editingId === transaction.id ? (
                        <>
                          <select
                            className="bw-select tx-row__select"
                            aria-label={`Category of ${name}`}
                            value={transaction.category_id || ''}
                            disabled={category.busy}
                            autoFocus
                            onChange={(event) => category.onSelect(transaction, event.target.value)}
                          >
                            {!transaction.category_id && <option value="">Choose a category</option>}
                            {category.options.filter(({ type }) => type === transaction.type).map((option) => (
                              <option value={option.id} key={option.id}>{option.name}</option>
                            ))}
                          </select>
                          <button type="button" className="tx-row__cancel" onClick={category.onCancel}>Cancel</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="tx-row__category"
                          aria-label={`Change the category of ${name}, now ${transaction.category}`}
                          onClick={() => category.onStart(transaction.id)}
                        >
                          {transaction.category}
                        </button>
                      )}
                      {transaction.bank && transaction.bank !== transaction.description && <span>{transaction.bank}</span>}
                    </div>
                  </div>
                  <div className="tx-row__amount">
                    {amount.editingId === transaction.id ? (
                      <input
                        className="bw-input tx-row__input"
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Amount of ${name}`}
                        value={amount.value}
                        autoFocus
                        onChange={(event) => amount.onChange(event.target.value)}
                        onBlur={() => amount.onCommit(transaction.id, amount.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') amount.onCommit(transaction.id, amount.value);
                          if (event.key === 'Escape') amount.onCancel();
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="tx-row__figure"
                        aria-label={`Change the amount of ${name}, now ${formatAmount(transaction.amount, transaction.type)}`}
                        onClick={() => amount.onStart(transaction)}
                      >
                        {formatAmount(transaction.amount, transaction.type)}
                      </button>
                    )}
                  </div>
                  <button type="button" className="tx-row__trash" aria-label={`Move ${name} to the trash`} onClick={() => onTrash(transaction.id)}>
                    <LuTrash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
