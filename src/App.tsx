import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES, REGIONS, type Country, type Region } from './data/countries';
import { centre, loadFeatures, type CountryFeature } from './lib/geo';
import { isCorrect, shuffle, type Answerable } from './lib/answers';
import { pickChoices } from './lib/choices';
import { flagUrl, preloadFlag } from './lib/flags';
import QuizMap from './components/QuizMap';
import AnswerInput from './components/AnswerInput';
import ChoiceButtons from './components/ChoiceButtons';

type RegionChoice = Region | 'World';
type Game = 'map' | 'flag' | 'capital';
type QuizType = 'typed' | 'choice';
type LengthChoice = 10 | 25 | 'all';

const GAMES: { value: Game; label: string; lede: string }[] = [
  { value: 'map', label: 'Map', lede: 'A country is highlighted on the map. Name it.' },
  { value: 'flag', label: 'Flags', lede: 'A flag is shown. Name the country.' },
  { value: 'capital', label: 'Capitals', lede: 'A country is named. Give its capital.' },
];

const QUIZ_TYPES: { value: QuizType; label: string }[] = [
  { value: 'typed', label: 'Type the answer' },
  { value: 'choice', label: 'Multiple choice' },
];

interface Question {
  country: Country;
  /** Options to pick from, in multiple-choice mode. */
  choices?: string[];
}

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

const CENTRES = new Map(COUNTRIES.map((c) => [c, centre(featuresFor(c))]));

const capitalOf = (c: Country): Answerable => ({ name: c.capital, aliases: c.capitalAliases });
const CAPITALS = COUNTRIES.map(capitalOf);

/** What the user has to name for this country in this game. */
function answerFor(country: Country, game: Game): Answerable {
  return game === 'capital' ? capitalOf(country) : country;
}

function Chips<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="chips">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`chip${o.value === value ? ' on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function App() {
  const [region, setRegion] = useState<RegionChoice>('World');
  const [game, setGame] = useState<Game>('map');
  const [quizType, setQuizType] = useState<QuizType>('typed');
  const [length, setLength] = useState<LengthChoice>(10);
  const [queue, setQueue] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const pool = useMemo(
    () => COUNTRIES.filter((c) => region === 'World' || c.region === region),
    [region],
  );

  const question = queue?.[index];
  const current = question?.country;
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

  // Fetch the next flag while the user answers this one.
  useEffect(() => {
    const next = queue?.[index + 1];
    if (game === 'flag' && next) preloadFlag(next.country.code);
  }, [game, queue, index]);

  function start() {
    const shuffled = shuffle(pool);
    const countries = length === 'all' ? shuffled : shuffled.slice(0, length);
    setQueue(
      countries.map((country) => ({
        country,
        // Decoys come from all countries, not just the chosen region, so
        // border countries still get their real neighbours as options.
        choices:
          quizType === 'choice'
            ? pickChoices(country, COUNTRIES, (c) => CENTRES.get(c)!).map((c) => answerFor(c, game).name)
            : undefined,
      })),
    );
    setIndex(0);
    setAnswers([]);
  }

  function answer(given: string) {
    if (!current || lastAnswer) return;
    setAnswers((a) => [...a, { country: current, given, correct: isCorrect(given, answerFor(current, game)) }]);
  }

  if (queue === null) {
    return (
      <main className="setup">
        <h1>Geography Quiz</h1>
        <p className="lede">{GAMES.find((g) => g.value === game)!.lede}</p>

        <Chips
          legend="Region"
          options={(['World', ...REGIONS] as RegionChoice[]).map((r) => ({ value: r, label: r }))}
          value={region}
          onChange={setRegion}
        />
        <Chips legend="Game" options={GAMES} value={game} onChange={setGame} />
        <Chips legend="Answer by" options={QUIZ_TYPES} value={quizType} onChange={setQuizType} />
        <Chips
          legend="Questions"
          options={([10, 25, 'all'] as LengthChoice[]).map((l) => ({
            value: l,
            label: l === 'all' ? `All ${pool.length}` : String(l),
          }))}
          value={length}
          onChange={setLength}
        />

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
                  <span className="missed-answer">
                    {game === 'flag' && <img className="mini-flag" src={flagUrl(a.country.code)} alt="" />}
                    <strong>{answerFor(a.country, game).name}</strong>
                    {game === 'capital' && <span className="muted"> · {a.country.name}</span>}
                  </span>
                  <span className="muted">{a.given ? `you said “${a.given}”` : 'skipped'}</span>
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

  const correctAnswer = current ? answerFor(current, game).name : '';

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

      <p className="prompt">
        {game === 'map' && 'Which country is highlighted?'}
        {game === 'flag' && 'Which country does this flag belong to?'}
        {game === 'capital' && (
          <>
            What is the capital of <strong>{current?.name}</strong>?
          </>
        )}
      </p>

      {game === 'flag' && current ? (
        <div className="flag-stage">
          <img key={current.code} className="flag" src={flagUrl(current.code)} alt="Flag to identify" />
        </div>
      ) : (
        <QuizMap
          allFeatures={ALL_FEATURES}
          target={target}
          status={lastAnswer ? (lastAnswer.correct ? 'correct' : 'wrong') : 'asking'}
        />
      )}

      <footer className="controls">
        {lastAnswer && (
          <div className={`feedback ${lastAnswer.correct ? 'good' : 'bad'}`} role="status">
            <span>
              {lastAnswer.correct ? (
                <>
                  ✓ Correct — <strong>{correctAnswer}</strong>
                </>
              ) : (
                <>
                  ✗ {lastAnswer.given ? <>Not “{lastAnswer.given}”. </> : null}
                  It's <strong>{correctAnswer}</strong>
                </>
              )}
            </span>
            <button ref={nextRef} type="button" className="btn primary" onClick={() => setIndex((i) => i + 1)}>
              {index + 1 < queue.length ? 'Next →' : 'See results'}
            </button>
          </div>
        )}
        {question?.choices ? (
          <ChoiceButtons choices={question.choices} answer={correctAnswer} picked={lastAnswer?.given} onPick={answer} />
        ) : (
          !lastAnswer && (
            <AnswerInput
              ref={inputRef}
              options={game === 'capital' ? CAPITALS : COUNTRIES}
              placeholder={game === 'capital' ? 'Type the capital…' : 'Type the country name…'}
              onSubmit={answer}
              onSkip={() => answer('')}
            />
          )
        )}
      </footer>
    </div>
  );
}
