import { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';

// The health score and the parts it is added up from. A part opens to show the sum
// behind its points and what would raise it. Takes the result of healthScore.
export default function HealthPanel({ health }) {
  const [open, setOpen] = useState(null);

  return (
    <section className="bw-panel assets-health" aria-labelledby="assets-health-heading">
      <header className="assets-panel__head">
        <h2 id="assets-health-heading">Financial health</h2>
        <span>out of 100</span>
      </header>
      <div className="assets-health__score" data-tone={health.tone}>
        <b>{health.score}</b>
        <div>
          <strong>{health.label}</strong>
          <div className="assets-health__scale" role="img" aria-label={`${health.score} out of 100`}>
            <i style={{ width: `${health.score}%` }} />
          </div>
        </div>
      </div>
      <ul className="assets-health__parts">
        {health.parts.map((part, index) => {
          const expanded = open === index;
          return (
            <li key={part.label}>
              <button
                type="button"
                className="assets-health__part"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : index)}
              >
                <span>{part.label}</span>
                <span className="assets-health__meter" aria-hidden="true">
                  <i style={{ width: `${(part.points / part.max) * 100}%` }} />
                </span>
                <b>{part.points} of {part.max}</b>
                <FiChevronDown aria-hidden="true" />
              </button>
              {expanded && (
                <div className="assets-health__why">
                  <p>{part.what}</p>
                  <p className="assets-health__sum">{part.sum}</p>
                  <p className="assets-health__sum">{part.scoring}</p>
                  <p>{part.tip}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
