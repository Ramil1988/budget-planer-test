// How long the savings would last, on a ruler that ends at the target, and the sums beside
// it. Takes the result of emergencyFund and of measures. `basis` says where the monthly
// spending comes from: this month's budget, or the average of what was spent.
export default function CushionPanel({ fund, liquid, investments, homeEquity, monthlyExpenses, basis, totalAssets, formatCurrency }) {
  const share = (part) => (totalAssets > 0 ? `${Math.round((part / totalAssets) * 100)}% of what you own` : null);
  const at = (months) => `${(months / fund.target) * 100}%`;

  return (
    <section className="bw-panel assets-cushion" aria-labelledby="assets-cushion-heading">
      <header className="assets-panel__head">
        <h2 id="assets-cushion-heading">Emergency fund</h2>
        <span data-tone={fund.tone}>{fund.label}</span>
      </header>
      <div className="assets-cushion__body">
        <p className="assets-cushion__months">
          <b>{fund.months.toFixed(1)}</b> months of spending covered
        </p>
        <div className="assets-ruler" data-tone={fund.tone} role="img" aria-label={`${fund.months.toFixed(1)} of ${fund.target} months`}>
          <i style={{ width: `${fund.progress * 100}%` }} />
          {[1, 3].map((mark) => <span style={{ left: at(mark) }} key={mark} />)}
        </div>
        <ol className="assets-ruler__marks" aria-hidden="true">
          <li style={{ left: 0 }}>0</li>
          <li style={{ left: at(1) }}>1</li>
          <li style={{ left: at(3) }}>3</li>
          <li style={{ left: '100%' }}>{fund.target} months</li>
        </ol>
        <p className="assets-cushion__basis">
          {monthlyExpenses > 0
            ? `${formatCurrency(liquid)} in cash, savings, TFSA and RRSP against ${basis === 'budget'
              ? `this month's budget of ${formatCurrency(monthlyExpenses)}`
              : `${formatCurrency(monthlyExpenses)} a month, the average of the last 12 months`}.`
            : 'Set a budget or record expenses to measure this.'}
        </p>
      </div>
      <dl className="assets-facts">
        <div>
          <dt>Within reach</dt>
          <dd>{formatCurrency(liquid)}<small>cash, savings, TFSA and RRSP</small></dd>
        </div>
        <div>
          <dt>Investments</dt>
          <dd>{formatCurrency(investments)}{share(investments) && <small>{share(investments)}</small>}</dd>
        </div>
        <div>
          <dt>Home equity</dt>
          <dd>{formatCurrency(homeEquity)}<small>real estate less mortgages</small></dd>
        </div>
      </dl>
    </section>
  );
}
