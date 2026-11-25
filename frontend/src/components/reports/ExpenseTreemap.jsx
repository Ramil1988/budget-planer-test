import { useLayoutEffect, useRef, useState } from 'react';
import { FiChevronRight } from 'react-icons/fi';
import { treemap } from '../../lib/reportView';

// The frame the tiles are laid out in. Its proportions decide the shape of the tiles;
// the positions are then written as percentages, so the map follows its container.
const FRAME = { width: 100, height: 62 };
// At most this many categories get a tile of their own; the rest share one that opens.
// A phone-wide map takes fewer, so that each tile is wide enough for a whole name.
const SHOWN = 11;
const SHOWN_NARROW = 7;
const NARROW = 480;
// A tile under a fortieth of the map has no room for its name, amount and share.
const SMALLEST = 0.025;
// How many times a tile may set its text smaller before it is given up on.
const TIGHTEST = 3;

const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);

// A name is never cut short: it may wrap, and "Mobile/Internet" may break after the slash.
const breakable = (name) => name.split('/').flatMap((part, index) => (index ? ['/', <wbr key={index} />, part] : [part]));

// The year's expenses as a map: every category is a tile, and the area of the tile is exactly
// its part of what the map shows. Takes the ranked categories, largest first.
//
// Two things hold for every tile: it is drawn to scale, and it carries its whole name, its
// amount and its share. A category whose tile cannot do both is not drawn at all; it is named
// under the map instead.
export default function ExpenseTreemap({ categories, formatCurrency }) {
  const [opened, setOpened] = useState(false);
  const [width, setWidth] = useState(0);
  // How tightly each tile has had to set its text, and which categories could not fit even so.
  // Both belong to one view at one width, and start over when either changes.
  const [fitting, setFitting] = useState({ key: '', levels: {}, dropped: [] });
  const tilesRef = useRef(null);

  const own = categories.slice(0, width && width < NARROW ? SHOWN_NARROW : SHOWN).filter(({ share }) => share >= SMALLEST);
  const rest = categories.slice(own.length);
  const restAmount = sum(rest, ({ amount }) => amount);
  const restShare = sum(rest, ({ share }) => share);
  // The rest get one tile together, if together they are large enough to have one.
  const lumped = rest.length > 0 && restShare >= SMALLEST;
  const inside = opened && lumped;

  const key = `${inside}:${width}:${categories.length}:${Math.round(restAmount)}`;
  const { levels, dropped } = fitting.key === key ? fitting : { levels: {}, dropped: [] };

  const candidates = inside
    ? rest.filter(({ amount }) => amount / restAmount >= SMALLEST)
    : lumped ? [...own, { name: `${rest.length} more`, amount: restAmount, share: restShare, more: true }] : own;
  const drawn = candidates.filter(({ name }) => !dropped.includes(name));
  const undrawn = [
    ...(inside ? rest.filter(({ amount }) => amount / restAmount < SMALLEST) : lumped ? [] : rest),
    ...candidates.filter(({ name }) => dropped.includes(name)),
  ].sort((a, b) => b.amount - a.amount);
  // The lumped remainder may outweigh the smallest tiles; the layout wants largest first.
  const ordered = [...drawn].sort((a, b) => b.amount - a.amount);
  const rects = treemap(ordered.map(({ amount }) => amount), FRAME.width, FRAME.height);
  const percent = (share) => (share < 0.01 ? '<1' : Math.round(share * 100));

  // The map's width decides how much room the tiles have, so the fitting restarts when it changes.
  useLayoutEffect(() => {
    const element = tilesRef.current;
    if (!element) return undefined;
    const measure = () => setWidth(Math.round(element.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ordered.length === 0]);

  // After each layout, any tile whose text does not fit sets it one step smaller. A tile that
  // is already at the smallest step is dropped from the map. Repeats until everything fits.
  useLayoutEffect(() => {
    const element = tilesRef.current;
    if (!element || !width) return;
    const nextLevels = { ...levels };
    const nextDropped = [...dropped];
    for (const tile of element.children) {
      // The text sits at the bottom of its tile, so what does not fit sticks out at the top,
      // where scrollHeight does not see it. Compare the boxes instead.
      const box = tile.getBoundingClientRect();
      const fits = [...tile.querySelectorAll('.reports-map__name, .reports-map__amount, .reports-map__share')].every((part) => {
        const inner = part.getBoundingClientRect();
        // A word wider than its line runs past the box without making the box any wider.
        if (part.scrollWidth > part.clientWidth + 1) return false;
        return inner.top >= box.top - 0.5 && inner.bottom <= box.bottom + 0.5 && inner.left >= box.left - 0.5 && inner.right <= box.right + 0.5;
      });
      if (fits) continue;
      const level = levels[tile.dataset.name] ?? 0;
      // The tile that opens the rest is never dropped: it is the way in.
      if (level < TIGHTEST || tile.dataset.more === 'true') nextLevels[tile.dataset.name] = Math.min(level + 1, TIGHTEST);
      else nextDropped.push(tile.dataset.name);
    }
    const changed = nextDropped.length !== dropped.length
      || Object.keys(nextLevels).some((name) => nextLevels[name] !== levels[name]);
    if (changed) setFitting({ key, levels: nextLevels, dropped: nextDropped });
  });

  return (
    <section className="bw-panel reports-map" aria-labelledby="reports-map-heading">
      <header className="reports-rank__head">
        <h2 id="reports-map-heading">The shape of the spending</h2>
        {inside ? (
          <button type="button" className="bw-button bw-button--quiet reports-map__back" onClick={() => setOpened(false)}>
            Back to all categories
          </button>
        ) : (
          <span>the area of a tile is its share</span>
        )}
      </header>
      {inside && (
        <p className="reports-map__note">
          The {rest.length} smallest categories, {formatCurrency(restAmount)} together.
        </p>
      )}
      {ordered.length === 0 ? (
        <p className="bw-nothing">Nothing recorded.</p>
      ) : (
        <ul className="reports-map__tiles" style={{ aspectRatio: `${FRAME.width} / ${FRAME.height}` }} ref={tilesRef}>
          {ordered.map((tile, index) => {
            const rect = rects[index];
            // Darkest for the largest tile, fading with rank.
            const strength = Math.round(92 - (index / Math.max(ordered.length - 1, 1)) * 64);
            return (
              <li
                className="reports-map__tile"
                data-dark={strength >= 58}
                data-more={tile.more}
                data-name={tile.name}
                data-amount={tile.amount}
                data-fit={levels[tile.name] ?? 0}
                title={`${tile.name}: ${formatCurrency(tile.amount)}, ${percent(tile.share)}%`}
                style={{
                  left: `${(rect.x / FRAME.width) * 100}%`,
                  top: `${(rect.y / FRAME.height) * 100}%`,
                  width: `${(rect.width / FRAME.width) * 100}%`,
                  height: `${(rect.height / FRAME.height) * 100}%`,
                  '--strength': `${strength}%`,
                }}
                key={tile.name}
              >
                <div className="reports-map__text">
                  {tile.more ? (
                    <button type="button" className="reports-map__open" onClick={() => setOpened(true)} aria-label={`Show the ${rest.length} smallest categories`}>
                      <span className="reports-map__name">{tile.name} <FiChevronRight aria-hidden="true" /></span>
                    </button>
                  ) : (
                    <span className="reports-map__name" lang="en">{breakable(tile.name)}</span>
                  )}
                  <span className="reports-map__figures">
                    <span className="reports-map__amount">{formatCurrency(tile.amount)}</span>
                    <span className="reports-map__share">{percent(tile.share)}%</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {undrawn.length > 0 && (
        <p className="reports-map__undrawn">
          Too small for a tile:{' '}
          {undrawn.map(({ name, amount, share }) => `${name} ${formatCurrency(amount)} (${percent(share)}%)`).join(', ')}.
        </p>
      )}
    </section>
  );
}
