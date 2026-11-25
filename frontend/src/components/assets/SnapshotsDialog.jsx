import { formatDay } from '../../lib/assetsView';
import DialogFrame from '../DialogFrame';

// The saved snapshots, newest first, each with a way to delete it.
export default function SnapshotsDialog({ open, onClose, snapshots, formatCurrency, onDelete }) {
  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      title="Snapshots"
      note={`${snapshots.length} saved. Each is one point on the net worth line.`}
      width="640px"
    >
      {snapshots.length === 0 ? (
        <p className="bw-nothing">No snapshots yet.</p>
      ) : (
        <table className="assets-snapshots">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Assets</th>
              <th scope="col">Liabilities</th>
              <th scope="col">Net worth</th>
              <th scope="col"><span className="assets-hidden">Delete</span></th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id}>
                <th scope="row">{formatDay(snapshot.record_date)}</th>
                <td>{formatCurrency(snapshot.total_assets)}</td>
                <td>{formatCurrency(snapshot.total_liabilities)}</td>
                <td data-tone={snapshot.equity < 0 ? 'bad' : 'good'}>{formatCurrency(snapshot.equity)}</td>
                <td>
                  <button type="button" onClick={() => onDelete(snapshot.id)} aria-label={`Delete the snapshot of ${formatDay(snapshot.record_date)}`}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DialogFrame>
  );
}
