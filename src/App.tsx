import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES, REGIONS, type Country, type Region } from './data/countries';
import { centre, loadFeatures, type CountryFeature } from './lib/geo';
import { isCorrect, shuffle, type Answerable } from './lib/answers';
import { pickChoices } from './lib/choices';
import { flagUrl, preloadFlag } from './lib/flags';
import {
  DAILY_LENGTH,
  dailyNumber,
  dailyQuiz,
  loadDailyResult,
  localDate,
  saveDailyResult,
  shareText,
  type QuestionKind,
} from './lib/daily';
import QuizMap from './components/QuizMap';
import AnswerInput from './components/AnswerInput';
import ChoiceButtons from './components/ChoiceButtons';
import ShareButton from './components/ShareButton';

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
  kind: QuestionKind;
  /** Options to pick from, in multiple-choice mode. */
  choices?: string[];
}

interface Answer {
  country: Country;
  kind: QuestionKind;
  given: string;
  correct: boolean;
}

const NO_FEATURES: CountryFeature[] = [];

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

/** What the user has to name for this country in this kind of question. */
function answerFor(country: Country, kind: QuestionKind): Answerable {
  return kind === 'capital' ? capitalOf(country) : country;
}

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

const squares = (results: boolean[]) => results.map((r) => (r ? '🟩' : '🟥')).join('');

/** The address to share: this page, without any query or hash. */
const pageUrl = () => location.origin + location.pathname;

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
  /** The date of the daily quiz being played, or null in practice mode. */
  const [daily, setDaily] = useState<string | null>(null);

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
  // "Capital of…" questions keep the map blank until answered, as the
  // highlighted country would give the answer away.
  const hideTarget = question?.kind === 'capital-of' && !lastAnswer;
  const target = useMemo(
    () => (current && !hideTarget ? featuresFor(current) : NO_FEATURES),
    [current, hideTarget],
  );
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
    if (next?.kind === 'flag') preloadFlag(next.country.code);
  }, [queue, index]);

  function begin(questions: Question[], date: string | null) {
    setQueue(questions);
    setDaily(date);
    setIndex(0);
    setAnswers([]);
  }

  function start() {
    const shuffled = shuffle(pool);
    const countries = length === 'all' ? shuffled : shuffled.slice(0, length);
    begin(
      countries.map((country) => ({
        country,
        kind: game,
        // Decoys come from all countries, not just the chosen region, so
        // border countries still get their real neighbours as options.
        choices:
          quizType === 'choice'
            ? pickChoices(country, COUNTRIES, (c) => CENTRES.get(c)!).map((c) => answerFor(c, game).name)
            : undefined,
      })),
      null,
    );
  }

  function startDaily() {
    const date = localDate();
    begin(
      dailyQuiz(date, (c) => CENTRES.get(c)!).map(({ country, kind, choices }) => ({
        country,
        kind,
        choices: choices.map((c) => answerFor(c, kind).name),
      })),
      date,
    );
  }

  function answer(given: string) {
    if (!question || !queue || lastAnswer) return;
    const { country, kind } = question;
    const next = [...answers, { country, kind, given, correct: isCorrect(given, answerFor(country, kind)) }];
    setAnswers(next);
    if (daily && next.length === queue.length) saveDailyResult(daily, next.map((a) => a.correct));
  }

  if (queue === null) {
    const today = localDate();
    const played = loadDailyResult(today);
    return (
      <main className="setup">
        <h1>Geography Quiz</h1>

        <section className="daily-card">
          <div>
            <h2>Daily quiz #{dailyNumber(today)}</h2>
            <p className="muted">
              {formatDate(today)} · {DAILY_LENGTH} mixed questions, the same for everyone today
            </p>
          </div>
          {played ? (
            <div className="daily-done">
              <span>
                You scored <strong>{played.filter(Boolean).length}</strong> / {played.length}{' '}
                <span aria-hidden="true">{squares(played)}</span>. Come back tomorrow for a new one.
              </span>
              <ShareButton text={shareText(today, played, pageUrl())} />
            </div>
          ) : (
            <button type="button" className="btn primary big" onClick={startDaily}>
              Play today's quiz
            </button>
          )}
        </section>

        <h2>Practice</h2>
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
    const results = answers.map((a) => a.correct);
    return (
      <main className="results">
        {daily && <p className="eyebrow">Daily quiz #{dailyNumber(daily)}</p>}
        <h1>
          {score} / {answers.length}
        </h1>
        <p className="lede">{pct}% correct</p>
        {daily && (
          <div className="row daily-share">
            <span className="squares" aria-hidden="true">
              {squares(results)}
            </span>
            <ShareButton text={shareText(daily, results, pageUrl())} />
          </div>
        )}
        {missed.length > 0 && (
          <section>
            <h2>To review</h2>
            <ul className="missed">
              {missed.map((a) => (
                <li key={a.country.name}>
                  <span className="missed-answer">
                    {a.kind === 'flag' && <img className="mini-flag" src={flagUrl(a.country.code)} alt="" />}
                    <strong>{answerFor(a.country, a.kind).name}</strong>
                    {a.kind === 'capital' && <span className="muted"> · {a.country.name}</span>}
                    {a.kind === 'capital-of' && <span className="muted"> · capital {a.country.capital}</span>}
                  </span>
                  <span className="muted">{a.given ? `you said “${a.given}”` : 'skipped'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="row">
          {daily ? (
            <button type="button" className="btn primary big" onClick={() => setQueue(null)}>
              Done
            </button>
          ) : (
            <>
              <button type="button" className="btn primary big" onClick={start}>
                Play again
              </button>
              <button type="button" className="btn ghost big" onClick={() => setQueue(null)}>
                Change settings
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  const kind = question?.kind;
  const correctAnswer = current && kind ? answerFor(current, kind).name : '';

  return (
    <div className="quiz">
      <header className="scorebar">
        <button type="button" className="btn ghost small" onClick={() => setQueue(null)}>
          ← Quit
        </button>
        <span>
          {daily && <span className="muted daily-tag">Daily #{dailyNumber(daily)} · </span>}
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
        {kind === 'map' && 'Which country is highlighted?'}
        {kind === 'flag' && 'Which country does this flag belong to?'}
        {kind === 'capital' && (
          <>
            What is the capital of <strong>{current?.name}</strong>?
          </>
        )}
        {kind === 'capital-of' && (
          <>
            <strong>{current?.capital}</strong> is the capital of which country?
          </>
        )}
      </p>

      {kind === 'flag' && current ? (
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
              options={kind === 'capital' ? CAPITALS : COUNTRIES}
              placeholder={kind === 'capital' ? 'Type the capital…' : 'Type the country name…'}
              onSubmit={answer}
              onSkip={() => answer('')}
            />
          )
        )}
      </footer>
    </div>
  );
}
