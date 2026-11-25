const day = (value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// What is in the trash, the most recently trashed first. Each row can be put back or
// deleted for good.
export default function TrashList({ transactions, restoringId, onRestore, onDelete, formatAmount, formatDate }) {
  return (
    <div className="bw-panel tx-list">
      <ul className="bw-rows tx-rows">
        {transactions.map((transaction) => {
          const name = transaction.description || transaction.category;
          return (
            <li className="tx-row tx-row--trashed" data-type={transaction.type} key={transaction.id}>
              <div className="tx-row__body">
                <p className="tx-row__name">{name}</p>
                <div className="tx-row__meta">
                  <span>{transaction.category}</span>
                  <span>{formatDate(transaction.date)}</span>
                  {transaction.deletedAt && <span>trashed {day(transaction.deletedAt)}</span>}
                </div>
              </div>
              <div className="tx-row__amount">
                <span className="tx-row__figure">{formatAmount(transaction.amount, transaction.type)}</span>
              </div>
              <div className="tx-row__actions">
                <button type="button" disabled={restoringId === transaction.id} onClick={() => onRestore(transaction.id)} aria-label={`Restore ${name}`}>
                  {restoringId === transaction.id ? 'Restoring…' : 'Restore'}
                </button>
                <button type="button" data-action="delete" onClick={() => onDelete(transaction.id)} aria-label={`Delete ${name} for good`}>
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
