// The deploy's build step: writes config.js, the settings that belong to where the site is served.
// GOOGLE_API_KEY, a repository variable, turns on loading from Google Drive; it is optional, because
// without it the page still loads stacks from the computer and says why the Drive option is off. The
// Drive folder that option opens on is the owner's stacks folder, read from data/sources.json.
//
//   node microviewer/build.mjs
//   python3 -m http.server 8000       from the repo root, then open http://localhost:8000/microviewer/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export function settings(env, sources) {
  let vars = {};
  try { vars = JSON.parse(env.REPO_VARS_JSON || '{}'); } catch { throw new Error('REPO_VARS_JSON is not valid JSON'); }
  const apiKey = env.GOOGLE_API_KEY || vars.GOOGLE_API_KEY || '';
  const folder = (sources.sources || []).find((s) => s.kind === 'folder');
  return { google: { apiKey }, drive: { defaultLink: folder ? `https://drive.google.com/drive/folders/${folder.drive_id}` : '' } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sources = JSON.parse(readFileSync(join(HERE, '..', 'data', 'sources.json'), 'utf8'));
  const s = settings(process.env, sources);
  writeFileSync(join(HERE, 'config.js'),
    '// written by microviewer/build.mjs from the repository variable GOOGLE_API_KEY and data/sources.json\n' +
    `window.MV_CONFIG = ${JSON.stringify(s)};\n`);
  console.log(`microviewer: Drive loading ${s.google.apiKey ? 'on' : 'off (no GOOGLE_API_KEY variable)'}`);
}
