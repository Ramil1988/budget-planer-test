// Page by the immutable ID so schedules with identical names stay distinct.
// The remaining count covers custom API limits and changes between page reads.
async function readNamedRows(supabase, userId, table, fields) {
  const rows = [];
  const pageSize = 1000;
  while (true) {
    let query = supabase.from(table).select(fields, { count: 'exact' })
      .eq('user_id', userId).order('id').limit(pageSize);
    if (rows.length) query = query.gt('id', rows.at(-1).id);
    const { data, error, count } = await query;
    if (error) throw error;
    if (!data.length) break;
    rows.push(...data);
    if (count != null ? data.length >= count : data.length < pageSize) break;
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function readRecurringCatalog(supabase, userId) {
  return Promise.all([
    readNamedRows(supabase, userId, 'recurring_payments', '*,categories(name)'),
    readNamedRows(supabase, userId, 'categories', 'id,name,type'),
  ]);
}
