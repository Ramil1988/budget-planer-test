const percent = (share) => (share < 0.01 ? '<1' : Math.round(share * 100));
// Darkest for the first segment, fading with rank.
const strength = (index, count) => Math.round(84 - (index / Math.max(count - 1, 1)) * 58);

function Segment({ kind, segment, shade, formatCurrency }) {
  return (
    <li
      className="assets-sheet__segment"
      data-kind={kind}
      data-dark={shade >= 52}
      style={{ width: `${segment.part * 100}%`, '--strength': `${shade}%` }}
      title={`${segment.name}: ${formatCurrency(segment.amount)}, ${percent(segment.share)}% of what you own`}
    >
      <span>{segment.name}</span>
    </li>
  );
}

function Key({ kind, segments, shades, formatCurrency }) {
  return (
    <ul className="assets-sheet__key">
      {segments.map((segment, index) => (
        <li data-kind={kind} style={{ '--strength': `${shades[index]}%` }} key={segment.name}>
          <i aria-hidden="true" />
          <span>{segment.name}</span>
          <b>{formatCurrency(segment.amount)}</b>
          <small>{percent(segment.share)}%</small>
        </li>
      ))}
    </ul>
  );
}

// The balance sheet drawn to scale: what is owned, by category, and right under it, on the
// same scale, what is owed and what is left. Takes the result of balanceSheet.
export default function BalanceSheet({ sheet, totalAssets, totalLiabilities, formatCurrency }) {
  const ownedShades = sheet.owned.map((_, index) => strength(index, sheet.owned.length));
  const owedShades = sheet.owed.map((_, index) => strength(index, Math.max(sheet.owed.length, 2)));

  return (
    <div className="assets-sheet">
      <section className="assets-sheet__row" aria-label="What you own, by category">
        <h3>What you own: {formatCurrency(totalAssets)}</h3>
        <ul className="assets-sheet__bar">
          {sheet.owned.map((segment, index) => (
            <Segment kind="owned" segment={segment} shade={ownedShades[index]} formatCurrency={formatCurrency} key={segment.name} />
          ))}
        </ul>
        <Key kind="owned" segments={sheet.owned} shades={ownedShades} formatCurrency={formatCurrency} />
      </section>

      <section className="assets-sheet__row" aria-label="What you owe, and what is left">
        <h3>
          What you owe: {formatCurrency(totalLiabilities)}
          {sheet.yours && `, and what is yours: ${formatCurrency(sheet.yours.amount)}`}
        </h3>
        <ul className="assets-sheet__bar">
          {sheet.owed.map((segment, index) => (
            <Segment kind="owed" segment={segment} shade={owedShades[index]} formatCurrency={formatCurrency} key={segment.name} />
          ))}
          {sheet.yours && (
            <Segment kind="yours" segment={{ ...sheet.yours, name: 'Yours' }} shade={84} formatCurrency={formatCurrency} />
          )}
        </ul>
        <Key
          kind="owed"
          segments={sheet.owed}
          shades={owedShades}
          formatCurrency={formatCurrency}
        />
        {sheet.yours && (
          <Key kind="yours" segments={[{ ...sheet.yours, name: 'Yours: net worth' }]} shades={[84]} formatCurrency={formatCurrency} />
        )}
        {sheet.short > 0 && (
          <p className="assets-sheet__short">You owe {formatCurrency(sheet.short)} more than you own.</p>
        )}
      </section>
    </div>
  );
}
