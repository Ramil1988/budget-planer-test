import { MONTH_NAMES } from '../../lib/reportView';

const signed = (amount, formatCurrency) => `${amount > 0 ? '+' : ''}${formatCurrency(amount)}`;
const tone = (amount) => (amount < 0 ? 'bad' : 'good');

// The year month by month, with the balance of the year so far in the last column.
export default function MonthTable({ months, totals, selected, formatCurrency }) {
  return (
    <div className="bw-panel reports-table-wrap">
      <table className="reports-table">
        <caption>Month by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Income</th>
            <th scope="col">Expenses</th>
            <th scope="col">Net</th>
            <th scope="col"><span className="reports-table__full">Year so far</span><abbr title="Year so far">Year</abbr></th>
          </tr>
        </thead>
        <tbody>
          {months.map((month, index) => (
            <tr data-recorded={month.recorded} data-selected={index === selected} key={month.month}>
              <th scope="row">
                <span className="reports-table__full">{MONTH_NAMES[index]}</span>
                <abbr title={MONTH_NAMES[index]}>{MONTH_NAMES[index].slice(0, 3)}</abbr>
              </th>
              {month.recorded ? (
                <>
                  <td>{formatCurrency(month.income)}</td>
                  <td>{formatCurrency(month.expenses)}</td>
                  <td data-tone={tone(month.balance)}>{signed(month.balance, formatCurrency)}</td>
                  <td data-tone={tone(month.running)}>{signed(month.running, formatCurrency)}</td>
                </>
              ) : (
                <><td>—</td><td>—</td><td>—</td><td>—</td></>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{formatCurrency(totals.income)}</td>
            <td>{formatCurrency(totals.expenses)}</td>
            <td data-tone={tone(totals.balance)}>{signed(totals.balance, formatCurrency)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
