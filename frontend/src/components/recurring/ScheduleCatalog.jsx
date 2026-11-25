import PaymentList from './PaymentList';

const types = [['all', 'All'], ['expense', 'Expenses'], ['income', 'Income']];
const categoryKey = (payment) => payment.category_id || 'uncategorized';

export default function ScheduleCatalog({ payments, filters, onFilters, formatCurrency, onToggle, onEdit, onDelete, onAdd }) {
  const groups = new Map();
  for (const payment of payments) {
    if (filters.type !== 'all' && payment.type !== filters.type) continue;
    const key = categoryKey(payment);
    if (!groups.has(key)) groups.set(key, { key, label: payment.categories?.name || 'Uncategorized', items: [] });
    groups.get(key).items.push(payment);
  }
  const categories = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key));
  const visible = categories.filter(({ key }) => !filters.category || filters.category === key)
    .map((group) => ({
      ...group,
      items: group.items.filter((payment) => {
        if (filters.status === 'all') return true;
        const status = !payment.is_active ? 'paused' : payment.nextDate ? 'active' : 'ended';
        return status === filters.status;
      }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    })).filter(({ items }) => items.length);

  return (
    <section className="recurring-catalog" aria-label="All schedules">
      <div className="bw-switches recurring-catalog__filters">
        <div className="bw-tabs" role="tablist" aria-label="Schedule type">
          {types.map(([value, label]) => (
            <button key={value} type="button" role="tab" className="bw-tab" aria-selected={filters.type === value}
              onClick={() => {
                const keep = payments.some((p) => categoryKey(p) === filters.category && (value === 'all' || p.type === value));
                onFilters({ ...filters, type: value, category: keep ? filters.category : '' });
              }}>
              {label} ({value === 'all' ? payments.length : payments.filter((p) => p.type === value).length})
            </button>
          ))}
        </div>
        <div className="bw-tools">
          <label>Category
            <select className="bw-select" value={filters.category} onChange={(e) => onFilters({ ...filters, category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>Status
            <select className="bw-select" value={filters.status} onChange={(e) => onFilters({ ...filters, status: e.target.value })}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="ended">Ended</option>
            </select>
          </label>
        </div>
      </div>
      {visible.length > 0 ? (
        <PaymentList groups={visible} catalog formatCurrency={formatCurrency} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <div className="bw-panel bw-nothing">
          <p>{payments.length ? 'No schedules match these filters.' : 'No recurring schedules yet.'}</p>
          {payments.length
            ? <button type="button" className="bw-button bw-button--quiet" onClick={() => onFilters({ type: 'all', status: 'all', category: '' })}>Clear filters</button>
            : <button type="button" className="bw-button" onClick={onAdd}>Add the first schedule</button>}
        </div>
      )}
    </section>
  );
}
