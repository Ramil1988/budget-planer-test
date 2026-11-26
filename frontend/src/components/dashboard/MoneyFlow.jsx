import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { FiArrowUpRight, FiChevronDown } from 'react-icons/fi';
import { flowLayout, moneyFlow } from '../../lib/dashboardView';

// On a phone the labels have narrow columns: a name may take two lines, so each part gets more room.
const NARROW = '(max-width: 599px)';
const watchWidth = (notify) => {
  const media = window.matchMedia(NARROW);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const isNarrow = () => window.matchMedia(NARROW).matches;

const COLORS = { income: 'var(--dashboard-positive)', leftover: 'var(--dashboard-positive)', shortfall: 'var(--dashboard-negative)' };
const colorOf = ({ kind, color }) => color ?? COLORS[kind] ?? 'var(--dashboard-muted)';
const SOURCE = 'other-money';
const listed = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]);

// A band from one edge to the other: `height` thick at both ends, curving between them.
// The svg is stretched, so x runs from 0 to 100 whatever the width; y is in pixels.
function band(fromX, fromTop, toX, toTop, height) {
  const turn = (fromX + toX) / 2;
  return `M${fromX},${fromTop} C${turn},${fromTop} ${turn},${toTop} ${toX},${toTop} V${toTop + height} `
    + `C${turn},${toTop + height} ${turn},${fromTop + height} ${fromX},${fromTop + height} Z`;
}

// The month's money as one diagram: every source of income on the left, every category it
// went to on the right, each band as thick as its amount. What was spent beyond income, or
// what is left of it, is a band of its own, so both sides are the same height.
//
// A category marked as paid from other money (`outside_income`, migration 012) is not fed
// from the income: it is drawn below, with a band straight from a source of its own.
// `categories` are the expense categories; `onMark(id, outside)` saves the mark and is left
// out when the database has no such column.
export default function MoneyFlow({ transactions, spending, categories, onMark, formatCurrency }) {
  const headingId = useId();
  const othersId = useId();
  const narrow = useSyncExternalStore(watchWidth, isNarrow);
  const flow = useMemo(() => {
    const outside = new Set(categories.filter((category) => category.outside_income).map(({ id }) => String(id)));
    return moneyFlow(transactions, spending.map((category) => ({ ...category, outside: outside.has(String(category.id)) })));
  }, [transactions, spending, categories]);
  const layout = useMemo(
    () => flowLayout(flow, narrow ? { base: 220, slot: 50, gap: 6 } : { base: 240, slot: 38, gap: 8 }),
    [flow, narrow],
  );
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const [failed, setFailed] = useState('');
  const active = hovered ?? selected;
  const dimmed = (key) => Boolean(active) && active !== key;
  const apart = layout.apart?.parts ?? [];
  const mark = (id, outside) => {
    setFailed('');
    onMark(id, outside).catch((error) => setFailed(`That was not saved: ${error.message}`));
  };

  const side = (nodes, name, label) => (
    <ul className="dashboard-moneyflow__side" data-side={name} aria-label={label}>
      {nodes.map((node, index) => {
        const others = node.kind === 'others';
        return (
          <li key={node.key} style={{ top: node.slotTop, height: node.slotHeight, '--order': index }} data-dimmed={dimmed(node.key)}>
            <button
              type="button"
              aria-pressed={others ? undefined : selected === node.key}
              aria-expanded={others ? othersOpen : undefined}
              aria-controls={others ? othersId : undefined}
              onClick={others ? () => setOthersOpen((open) => !open) : () => setSelected((current) => (current === node.key ? null : node.key))}
              onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(node.key); }}
              onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHovered(null); }}
              onFocus={() => setHovered(node.key)}
              onBlur={() => setHovered(null)}
            >
              <span className="dashboard-moneyflow__name">{node.name}</span>
              <span className="dashboard-moneyflow__figure">
                <b>{formatCurrency(node.amount)}</b>
                {node.share !== undefined && <> {node.share.toFixed(0)}%</>}
                {others && <FiChevronDown aria-hidden="true" data-open={othersOpen} />}
              </span>
            </button>
            <i aria-hidden="true" style={{ top: node.top - node.slotTop, height: node.height, background: colorOf(node) }} />
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="dashboard-moneyflow" aria-labelledby={headingId}>
      <header className="dashboard-moneyflow__head">
        <h2 id={headingId}>Where the money went</h2>
        <RouterLink to="/budget">Details <FiArrowUpRight aria-hidden="true" /></RouterLink>
      </header>

      {flow.total === 0 && flow.other === 0 ? (
        <p className="dashboard-moneyflow__note">Nothing is recorded for this month yet.</p>
      ) : (
        <>
          <div className="dashboard-moneyflow__plot" style={{ height: layout.height }}>
            {side(layout.apart ? [...layout.left, layout.apart.source] : layout.left, 'left', 'Where the money came from')}
            <div className="dashboard-moneyflow__bands">
              <svg viewBox={`0 0 100 ${layout.height}`} preserveAspectRatio="none" aria-hidden="true">
                {layout.left.map((node) => (
                  <path key={node.key} d={band(0, node.top, 50, node.joinTop, node.height)} fill={colorOf(node)} data-dimmed={dimmed(node.key)} data-active={active === node.key} />
                ))}
                {layout.right.map((node) => (
                  <path key={node.key} d={band(50, node.joinTop, 100, node.top, node.height)} fill={colorOf(node)} data-dimmed={dimmed(node.key)} data-active={active === node.key} />
                ))}
                {apart.map((node) => (
                  <path
                    key={node.key}
                    d={band(0, node.fromTop, 100, node.top, node.height)}
                    fill={colorOf(node)}
                    data-dimmed={dimmed(node.key) && active !== SOURCE}
                    data-active={active === node.key || active === SOURCE}
                  />
                ))}
              </svg>
              {layout.middle.height > 0 && (
                <i className="dashboard-moneyflow__middle" aria-hidden="true" style={{ top: layout.middle.top, height: layout.middle.height }} />
              )}
            </div>
            {side([...layout.right, ...apart], 'right', 'Where the money went')}
          </div>

          {flow.others.length > 0 && (
            <ul id={othersId} className="dashboard-moneyflow__others" hidden={!othersOpen} aria-label="The other categories">
              {flow.others.map((category) => (
                <li key={category.key}>
                  <i aria-hidden="true" style={{ background: category.color }} />
                  <span>{category.name}</span>
                  <b>{formatCurrency(category.amount)}</b>
                </li>
              ))}
            </ul>
          )}

          {flow.spent - flow.other > flow.income && (
            <p className="dashboard-moneyflow__note">
              Shortfall is what the income did not cover: {formatCurrency(flow.spent - flow.other - flow.income)}.
            </p>
          )}
          {flow.outside.length > 0 && (
            <p className="dashboard-moneyflow__note">
              Other money pays for {listed(flow.outside.map(({ name }) => name))}: it is not part of the income recorded here.
            </p>
          )}
        </>
      )}

      {onMark && categories.length > 0 && (
        <details className="dashboard-moneyflow__setup">
          <summary>Categories paid from other money</summary>
          <p>
            Tick a category that is not paid from the income recorded here, such as a mortgage paid from another account.
            It gets a source of its own in the diagram and does not count towards the shortfall. It is saved as you tick it.
          </p>
          <div className="dashboard-moneyflow__marks">
            {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((category) => (
              <label key={category.id}>
                <input type="checkbox" checked={Boolean(category.outside_income)} onChange={(event) => mark(category.id, event.target.checked)} />
                {category.name}
              </label>
            ))}
          </div>
          {failed && <p role="alert">{failed}</p>}
        </details>
      )}
    </section>
  );
}
