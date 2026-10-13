import { useEffect } from 'react';

interface Props {
  choices: string[];
  answer: string;
  /** The option the user picked, once they've answered. */
  picked?: string;
  onPick: (name: string) => void;
}

export default function ChoiceButtons({ choices, answer, picked, onPick }: Props) {
  const answered = picked !== undefined;

  // Number keys 1–4 pick an option.
  useEffect(() => {
    if (answered) return;
    function onKey(e: KeyboardEvent) {
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < choices.length) onPick(choices[i]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, choices, onPick]);

  return (
    <div className="choices">
      {choices.map((c, i) => {
        let state = '';
        if (answered && c === answer) state = ' right';
        else if (answered && c === picked) state = ' wrong';
        return (
          <button
            key={c}
            type="button"
            className={`choice${state}`}
            disabled={answered}
            onClick={() => onPick(c)}
          >
            <kbd>{i + 1}</kbd>
            {c}
          </button>
        );
      })}
    </div>
  );
}
