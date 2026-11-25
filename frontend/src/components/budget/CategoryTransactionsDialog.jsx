import { CloseButton, Dialog, Portal, Spinner } from '@chakra-ui/react';

const day = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// What was spent in one category this month, opened from its row.
export default function CategoryTransactionsDialog({ category, item, transactions, loading, monthName, onClose, formatCurrency }) {
  const total = transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const limit = item?.limit ?? 0;
  const spent = item?.spent ?? total;

  return (
    <Dialog.Root open={Boolean(category)} onOpenChange={(event) => !event.open && onClose()}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content
            className="bw-surface bw-dialog"
            bg="var(--bw-paper)"
            color="var(--bw-ink)"
            borderRadius="15px"
            maxW="520px"
            w="92vw"
            maxH="82vh"
            p={0}
          >
            <header className="bw-dialog__head">
              <div style={{ minWidth: 0, flex: 1 }}>
                <Dialog.Title asChild><h2>{category?.name}</h2></Dialog.Title>
                <p>
                  {monthName}
                  {limit > 0
                    ? `: ${formatCurrency(spent)} of ${formatCurrency(limit)}, ${formatCurrency(Math.abs(limit - spent))} ${spent > limit ? 'over' : 'left'}`
                    : `: ${formatCurrency(spent)} spent, no limit set`}
                </p>
                {limit > 0 && (
                  <div className="budget-meter" data-status={spent > limit ? 'over' : undefined}>
                    <div className="budget-meter__bar">
                      <span
                        className="budget-part"
                        data-part={spent > limit ? 'over' : 'spent'}
                        style={{ width: `${Math.min(spent / limit, 1) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <Dialog.CloseTrigger asChild position="static">
                <CloseButton size="sm" color="var(--bw-muted)" _hover={{ bg: 'var(--bw-hover)' }} aria-label="Close" />
              </Dialog.CloseTrigger>
            </header>

            <div className="bw-dialog__body">
              {loading ? (
                <div className="bw-status" role="status"><Spinner size="sm" color="currentColor" />Loading transactions…</div>
              ) : transactions.length === 0 ? (
                <p className="bw-nothing">Nothing was spent in this category in {monthName}.</p>
              ) : (
                <ul className="bw-dialog__list">
                  {transactions.map((transaction) => (
                    <li key={transaction.id}>
                      <span>
                        {transaction.description || 'No description'}
                        <small>{day(transaction.date)}</small>
                      </span>
                      <b>{formatCurrency(transaction.amount)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!loading && transactions.length > 0 && (
              <footer className="bw-dialog__foot">
                <span>{transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}</span>
                <b>{formatCurrency(total)}</b>
              </footer>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
