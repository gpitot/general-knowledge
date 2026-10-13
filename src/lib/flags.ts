// Flag SVGs from flag-icons (MIT). Each is emitted as its own file and only
// downloaded when shown, so they don't add to the initial page load.
const urls = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});

export function flagUrl(code: string): string {
  return urls[`/node_modules/flag-icons/flags/4x3/${code}.svg`];
}

/** Start downloading a flag ahead of time (e.g. the next question's). */
export function preloadFlag(code: string): void {
  new Image().src = flagUrl(code);
}
