import { useState } from 'react';
import DialogFrame from '../DialogFrame';

// Asks before an asset or a debt is deleted. `item` is { kind: 'asset' | 'liability', name }.
export default function ConfirmDelete({ item, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
    onClose();
  };

  return (
    <DialogFrame open={Boolean(item)} onClose={onClose} title={`Delete this ${item?.kind || 'record'}?`} width="420px">
      <div className="assets-confirm">
        <p><b>{item?.name}</b> will be removed for good. Snapshots already saved keep the figures they were taken with.</p>
        <div className="assets-confirm__actions">
          <button type="button" className="bw-button bw-button--quiet" onClick={onClose}>Cancel</button>
          <button type="button" className="bw-button assets-confirm__delete" onClick={confirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </DialogFrame>
  );
}
