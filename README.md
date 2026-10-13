# General Knowledge

A small web app for learning general knowledge, starting with geography.

**Play it:** https://gpitot.github.io/general-knowledge/

## Geography quiz

Three games, each played by typing (with autocomplete) or by multiple choice:

- **Map:** a country is highlighted on a zoomable, pannable world map. Name it.
- **Flags:** a flag is shown. Name the country.
- **Capitals:** a country is named and highlighted on the map. Give its capital.

Pick a region (World, Africa, Asia, Europe, North America, South America, Oceania), a game, how to answer, and how many questions (10, 25 or all). Wrong answers show the correct one, your score and streak are tracked as you go, and the end screen lists what you missed.

- Typed answers ignore case, accents and punctuation, and accept common alternatives: "USA", "Burma", "Ivory Coast" for countries, "Washington DC", "Kiev", "Bogota" for capitals. Countries with two official capitals accept either (e.g. Bolivia: Sucre or La Paz).
- In multiple choice, the three wrong options come from the 8 countries nearest the answer, so they're plausible neighbours. Keys 1–4 pick an option.
- Microstates and small island nations get a ring around them on the map so you can spot them.
- Keyboard: ↑/↓ moves through suggestions, Enter picks one, Enter again submits, and Enter on the result goes to the next question.

The quiz covers 196 sovereign states: the 193 UN members plus Vatican City, Palestine, Kosovo and Taiwan, minus Tuvalu, which has no shape in the 1:50m map data.

## Development

```sh
npm install
npm run dev       # start the dev server
npm test          # unit tests (answer matching, country data, map geometry)
npm run build     # typecheck + production build into dist/
```

Every push to `main` runs the tests, builds the site and deploys it to GitHub Pages (`.github/workflows/deploy.yml`).

Built with Vite, React, TypeScript and Leaflet. Flags are from [flag-icons](https://github.com/lipis/flag-icons) (MIT). Country shapes come from [Natural Earth](https://www.naturalearthdata.com/) via [`world-atlas`](https://github.com/topojson/world-atlas). They're drawn as vectors with no tile basemap, because map tiles carry place names that would give the answers away.

### Layout

- `src/data/countries.ts`: the quiz's country list, with regions, ISO codes, capitals and accepted alternatives
- `src/lib/answers.ts`: answer normalisation, matching and autocomplete ranking
- `src/lib/flags.ts`: flag image URLs (each flag is a separate file, loaded when shown)
- `src/lib/geo.ts`: loads map shapes, fixes countries that cross the 180° meridian, and picks the zoom framing
- `src/components/QuizMap.tsx`: the Leaflet map
- `src/components/AnswerInput.tsx`: the autocomplete input
- `src/components/ChoiceButtons.tsx` and `src/lib/choices.ts`: multiple-choice options, picked from the nearest countries
- `src/App.tsx`: quiz flow (setup → questions → results)
