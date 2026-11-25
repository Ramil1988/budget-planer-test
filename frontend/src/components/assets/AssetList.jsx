const percent = (share) => (share < 0.001 ? '<0.1' : (share * 100).toFixed(1));

// Everything that is owned, the most valuable first, each with its category and its share
// of the total. Takes the groups of assetGroups.
export default function AssetList({ groups, totalAssets, formatCurrency, onAdd, onEdit, onDelete }) {
  const rows = groups
    .flatMap((group) => group.items.map((asset) => ({ asset, category: group.name })))
    .sort((a, b) => (parseFloat(b.asset.amount) || 0) - (parseFloat(a.asset.amount) || 0));

  return (
    <section className="bw-panel assets-list" aria-labelledby="assets-owned-heading">
      <header className="assets-panel__head">
        <div>
          <h2 id="assets-owned-heading">Assets</h2>
          <p>{rows.length === 0 ? 'Nothing recorded yet' : `${rows.length} ${rows.length === 1 ? 'asset' : 'assets'}, ${formatCurrency(totalAssets)}`}</p>
        </div>
        <button type="button" className="bw-button bw-button--quiet" onClick={onAdd}>Add asset</button>
      </header>
      {rows.length === 0 ? (
        <p className="bw-nothing">Add a home, an account or a car to see what you own.</p>
      ) : (
        <ul className="bw-rows assets-rows">
          {rows.map(({ asset, category }) => {
            const share = totalAssets > 0 ? asset.amount / totalAssets : 0;
            return (
              <li className="assets-row" key={asset.id}>
                <div className="assets-row__body">
                  <p className="assets-row__name">{asset.name}</p>
                  <p className="assets-row__meta">{[category, asset.note].filter(Boolean).join(', ')}</p>
                </div>
                <div className="assets-row__share" aria-hidden="true"><i style={{ width: `${share * 100}%` }} /></div>
                <div className="assets-row__amount">
                  <b>{formatCurrency(asset.amount)}</b>
                  <small>{percent(share)}%</small>
                </div>
                <div className="assets-row__actions">
                  <button type="button" onClick={() => onEdit(asset)} aria-label={`Edit ${asset.name}`}>Edit</button>
                  <button type="button" data-action="delete" onClick={() => onDelete(asset)} aria-label={`Delete ${asset.name}`}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
