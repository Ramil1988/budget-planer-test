import { useEffect, useRef, useState } from 'react';
import { Portal } from '@chakra-ui/react';
import { FiRepeat } from 'react-icons/fi';

const PANEL_WIDTH = 240;
const money = (amount) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Marks a category that recurring payments feed. Hovering (or tapping, on touch
// devices) lists those payments and what they cost per month.
export default function RecurringBadge({ info }) {
  const [coords, setCoords] = useState(null);
  const anchorRef = useRef(null);

  // The panel is placed in viewport coordinates, so it closes when the page moves under it.
  useEffect(() => {
    if (!coords) return undefined;
    const close = () => setCoords(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [coords]);

  if (!info) return null;

  const finePointer = () => window.matchMedia('(pointer: fine)').matches;
  const open = () => {
    const rect = anchorRef.current.getBoundingClientRect();
    const margin = 12;
    setCoords({
      top: rect.bottom + 8,
      left: Math.min(Math.max(margin, rect.left), window.innerWidth - margin - PANEL_WIDTH),
    });
  };

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        className="budget-recurring"
        aria-label={`${info.count} recurring ${info.count === 1 ? 'payment' : 'payments'}, ${money(info.monthly)} a month`}
        aria-expanded={Boolean(coords)}
        onMouseEnter={() => finePointer() && open()}
        onMouseLeave={() => finePointer() && setCoords(null)}
        onFocus={open}
        onBlur={() => setCoords(null)}
        onClick={() => (coords && !finePointer() ? setCoords(null) : open())}
      >
        <FiRepeat aria-hidden="true" size={11} />
        {info.count}
      </button>

      {coords && (
        <Portal>
          <div className="bw-surface budget-recurring-panel" style={{ top: coords.top, left: coords.left }} role="status">
            <h4>Recurring payments</h4>
            <ul>
              {info.items.map((item) => (
                <li key={item.name}>
                  <span>{item.name}<small>{item.frequency}</small></span>
                  <span>{money(item.amount)}</span>
                </li>
              ))}
            </ul>
            <p><span>A month</span><span>{money(info.monthly)}</span></p>
          </div>
        </Portal>
      )}
    </>
  );
}
