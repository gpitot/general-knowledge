import { useId, useMemo, useState, forwardRef } from 'react';
import type { Country } from '../data/countries';
import { suggest } from '../lib/answers';

interface Props {
  countries: Country[];
  onSubmit: (answer: string) => void;
  onSkip: () => void;
}

const AnswerInput = forwardRef<HTMLInputElement, Props>(function AnswerInput(
  { countries, onSubmit, onSkip },
  ref,
) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  const suggestions = useMemo(() => suggest(value, countries), [value, countries]);
  const showList = open && suggestions.length > 0;

  function pick(name: string) {
    setValue(name);
    setOpen(false);
    setActive(-1);
  }

  function submit() {
    if (!value.trim()) return;
    onSubmit(value);
    setValue('');
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showList && active >= 0) pick(suggestions[active].country.name);
      else submit();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <form
      className="answer-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="combo">
        <input
          ref={ref}
          type="text"
          value={value}
          placeholder="Type the country name…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {showList && (
          <ul className="suggestions" id={listId} role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={s.country.name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : undefined}
                // mousedown (not click) so the input doesn't blur first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s.country.name);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {s.country.name}
                {s.via && <span className="via"> ({s.via})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="btn primary" disabled={!value.trim()}>
        Submit
      </button>
      <button type="button" className="btn ghost" onClick={onSkip}>
        Don't know
      </button>
    </form>
  );
});

export default AnswerInput;
