// EMBERLINE — entrypoint for make.fun's threejs-fps-01 bounty (Node 22, standard
// library only). The game is the static files under game/, loaded by the browser as
// ES modules with three.js from an import map. This program hands the entry in: it
// copies game/ and screenshots/ from beside this file into the output directory
// and writes /output/dossier.json, the summary the judge reads, with make.fun's
// vendored library. Run it locally with MAKEFUN_OUTPUT_DIR standing in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The caps mirror the scorer's gate: at most 4 screenshots of 256 KiB each, game/
// at most 993 files and directories and 48 MiB in all, and the dossier text at
// most 160 KiB. Passing them here means the program fails exactly where the
// scorer would refuse the entry.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
