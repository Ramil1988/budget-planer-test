import DialogFrame from '../DialogFrame';

// A question with one or two answers and a way out. `actions` are the answers, each
// { label, busyLabel, tone: 'bad' | undefined, quiet, onClick }; `busy` disables them.
export default function ConfirmDialog({ open, onClose, title, children, actions, busy }) {
  return (
    <DialogFrame open={open} onClose={onClose} title={title} width="440px">
      <div className="tx-confirm">
        {children}
        <div className="tx-confirm__actions">
          <button type="button" className="bw-button bw-button--quiet" onClick={onClose} disabled={busy}>Cancel</button>
          {actions.map((action) => (
            <button
              type="button"
              className={`bw-button${action.quiet ? ' bw-button--quiet' : ''}`}
              data-tone={action.tone}
              disabled={busy}
              onClick={action.onClick}
              key={action.label}
            >
              {busy && action.busyLabel ? action.busyLabel : action.label}
            </button>
          ))}
        </div>
      </div>
    </DialogFrame>
  );
}
