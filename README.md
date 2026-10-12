# General Knowledge

A small web app for learning general knowledge, starting with geography.

**Play it:** https://gpitot.github.io/general-knowledge/

## Geography quiz

A country is highlighted on a zoomable, pannable world map. Type its name (a dropdown suggests matches as you type) and submit. Wrong answers show the correct one, and your score and streak are tracked as you go. At the end you get a list of the countries you missed.

- Pick a region (World, Africa, Asia, Europe, North America, South America, Oceania) and a quiz length (10, 25 or all).
- Answers ignore case, accents and punctuation, and accept common alternative names (e.g. "USA", "Burma", "Ivory Coast", "Czech Republic").
- Microstates and small island nations get a ring around them so you can spot them.
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

Built with Vite, React, TypeScript and Leaflet. Country shapes come from [Natural Earth](https://www.naturalearthdata.com/) via [`world-atlas`](https://github.com/topojson/world-atlas). They're drawn as vectors with no tile basemap, because map tiles carry place names that would give the answers away.

### Layout

- `src/data/countries.ts`: the quiz's country list, with regions and accepted aliases
- `src/lib/answers.ts`: answer normalisation, matching and autocomplete ranking
- `src/lib/geo.ts`: loads map shapes, fixes countries that cross the 180° meridian, and picks the zoom framing
- `src/components/QuizMap.tsx`: the Leaflet map
- `src/components/AnswerInput.tsx`: the autocomplete input
- `src/App.tsx`: quiz flow (setup → questions → results)
