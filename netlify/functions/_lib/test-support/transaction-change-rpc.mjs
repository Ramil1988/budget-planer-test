// Only applies the reviewed values to fixtures. Locking, authorization and rollback
// are exercised against Postgres in backend/database/tests/assistant-changes.sh.
export function applyFixtureChanges(rows, userId, plan) {
  for (const { id, version } of plan.sources) {
    const row = rows.find((entry) => entry.user_id === userId && entry.id === id);
    if (!row || row.deleted_at || row.assistant_change_version !== version) {
      return { error: { code: 'PT409' } };
    }
  }
  for (const addition of plan.additions) {
    rows.push({ ...addition, user_id: userId, deleted_at: null, assistant_change_version: 1 });
  }
  for (const update of plan.updates) Object.assign(rows.find(({ id }) => id === update.id), update);
  for (const removal of plan.removals) rows.find(({ id }) => id === removal.id).deleted_at = new Date().toISOString();
  for (const source of plan.sources) rows.find(({ id }) => id === source.id).assistant_change_version++;
  return { data: null, error: null };
}
