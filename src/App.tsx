import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES, REGIONS, type Country, type Region } from './data/countries';
import { loadFeatures, type CountryFeature } from './lib/geo';
import { isCorrect, shuffle } from './lib/answers';
import QuizMap from './components/QuizMap';
import AnswerInput from './components/AnswerInput';

type RegionChoice = Region | 'World';
type LengthChoice = 10 | 25 | 'all';

interface Answer {
  country: Country;
  given: string;
  correct: boolean;
}

const FEATURES = loadFeatures();
const ALL_FEATURES = [...FEATURES.values()];

function featuresFor(country: Country): CountryFeature[] {
  return [country.atlas ?? country.name, ...(country.includes ?? [])]
    .map((n) => FEATURES.get(n))
    .filter((f): f is CountryFeature => !!f);
}

export default function App() {
  const [region, setRegion] = useState<RegionChoice>('World');
  const [length, setLength] = useState<LengthChoice>(10);
  const [queue, setQueue] = useState<Country[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const pool = useMemo(
    () => COUNTRIES.filter((c) => region === 'World' || c.region === region),
    [region],
  );

  const current = queue?.[index];
  const lastAnswer = answers.length > index ? answers[index] : undefined;
  const finished = queue !== null && index >= queue.length;
  const target = useMemo(() => (current ? featuresFor(current) : []), [current]);
  const score = answers.filter((a) => a.correct).length;
  const streak = useMemo(() => {
    let s = 0;
    for (let i = answers.length - 1; i >= 0 && answers[i].correct; i--) s++;
    return s;
  }, [answers]);

  useEffect(() => {
    if (lastAnswer) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [lastAnswer, index]);

  function start() {
    const shuffled = shuffle(pool);
    setQueue(length === 'all' ? shuffled : shuffled.slice(0, length));
    setIndex(0);
    setAnswers([]);
  }

  function answer(given: string) {
    if (!current || lastAnswer) return;
    setAnswers((a) => [...a, { country: current, given, correct: isCorrect(given, current) }]);
  }

  if (queue === null) {
    return (
      <main className="setup">
        <h1>Geography Quiz</h1>
        <p className="lede">A country is highlighted on the map. Name it.</p>

        <fieldset>
          <legend>Region</legend>
          <div className="chips">
            {(['World', ...REGIONS] as RegionChoice[]).map((r) => (
              <button key={r} type="button" className={`chip${r === region ? ' on' : ''}`} onClick={() => setRegion(r)}>
                {r}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Questions</legend>
          <div className="chips">
            {([10, 25, 'all'] as LengthChoice[]).map((l) => (
              <button key={l} type="button" className={`chip${l === length ? ' on' : ''}`} onClick={() => setLength(l)}>
                {l === 'all' ? `All ${pool.length}` : l}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="button" className="btn primary big" onClick={start}>
          Start quiz
        </button>
      </main>
    );
  }

  if (finished) {
    const missed = answers.filter((a) => !a.correct);
    const pct = Math.round((score / answers.length) * 100);
    return (
      <main className="results">
        <h1>
          {score} / {answers.length}
        </h1>
        <p className="lede">{pct}% correct</p>
        {missed.length > 0 && (
          <section>
            <h2>To review</h2>
            <ul className="missed">
              {missed.map((a) => (
                <li key={a.country.name}>
                  <strong>{a.country.name}</strong>
                  <span>{a.given ? `you said “${a.given}”` : 'skipped'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="row">
          <button type="button" className="btn primary big" onClick={start}>
            Play again
          </button>
          <button type="button" className="btn ghost big" onClick={() => setQueue(null)}>
            Change settings
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="quiz">
      <header className="scorebar">
        <button type="button" className="btn ghost small" onClick={() => setQueue(null)}>
          ← Quit
        </button>
        <span>
          Question <strong>{index + 1}</strong> of {queue.length}
        </span>
        <span>
          Score <strong>{score}</strong> / {answers.length}
        </span>
        <span className="streak" aria-label={`Streak ${streak}`}>
          🔥 {streak}
        </span>
      </header>

      <QuizMap
        allFeatures={ALL_FEATURES}
        target={target}
        status={lastAnswer ? (lastAnswer.correct ? 'correct' : 'wrong') : 'asking'}
      />

      <footer className="controls">
        {lastAnswer ? (
          <div className={`feedback ${lastAnswer.correct ? 'good' : 'bad'}`} role="status">
            <span>
              {lastAnswer.correct ? (
                <>
                  ✓ Correct — <strong>{lastAnswer.country.name}</strong>
                </>
              ) : (
                <>
                  ✗ {lastAnswer.given ? <>Not “{lastAnswer.given}”. </> : null}
                  It's <strong>{lastAnswer.country.name}</strong>
                </>
              )}
            </span>
            <button ref={nextRef} type="button" className="btn primary" onClick={() => setIndex((i) => i + 1)}>
              {index + 1 < queue.length ? 'Next →' : 'See results'}
            </button>
          </div>
        ) : (
          <AnswerInput
            ref={inputRef}
            countries={COUNTRIES}
            onSubmit={answer}
            onSkip={() => answer('')}
          />
        )}
      </footer>
    </div>
  );
}
