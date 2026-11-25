// The ledger can filter any historical period. Page by immutable id so a new
// transaction cannot shift rows across two offset-based pages.
export async function readActiveTransactions(supabase, userId) {
  const fields = 'id,description,date,amount,type,provider,category_id,created_at,categories(name)';
  const rows = [];
  let total;
  while (true) {
    let query = supabase.from('transactions').select(fields, rows.length ? {} : { count: 'exact' })
      .eq('user_id', userId).is('deleted_at', null).order('id').limit(1000);
    if (rows.length) query = query.gt('id', rows.at(-1).id);
    const { data, error, count } = await query;
    if (error) throw error;
    if (!data.length) break;
    total ??= count;
    rows.push(...data);
    if (total != null ? rows.length >= total : data.length < 1000) break;
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || Date.parse(b.created_at) - Date.parse(a.created_at)
    || b.id.localeCompare(a.id));
}
