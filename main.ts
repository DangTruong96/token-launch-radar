import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSnapshot, buildRadar, boardIssue, dataScript } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

function option(key: string, fallback: string): string {
  const flag = `--${key}`;
  const at = process.argv.indexOf(flag);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1];
  const inline = process.argv.find(value => value.startsWith(`${flag}=`));
  return inline === undefined ? fallback : inline.slice(flag.length + 1);
}

function copyDirectory(source: string, destination: string, recursive: boolean): string[] {
  if (!existsSync(source)) return [];
  mkdirSync(destination, { recursive: true });
  const files: string[] = [];
  for (const name of readdirSync(source).sort()) {
    if (name.startsWith('.')) continue;
    const from = join(source, name);
    const to = join(destination, name);
    const info = statSync(from);
    if (info.isDirectory() && recursive) {
      files.push(...copyDirectory(from, to, true).map(child => `${name}/${child}`));
    } else if (info.isFile()) {
      copyFileSync(from, to);
      files.push(name);
    }
  }
  return files;
}

function run(): number {
  const input = option('input', '/input');
  const path = input.endsWith('.json') ? input : join(input, 'snapshot.json');
  if (!existsSync(path)) {
    process.stderr.write(`token radar: no snapshot at ${path}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
    return 2;
  }
  const out = option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  const snapshot = parseSnapshot(readFileSync(path, 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue) {
    process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
    return 1;
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'board.json'), JSON.stringify({ rows: board }) + '\n');
  writeFileSync(join(out, 'data.js'), dataScript(radar));
  const root = fileURLToPath(new URL('.', import.meta.url));
  const dashboard = copyDirectory(join(root, 'dashboard'), join(out, 'dashboard'), true);
  const shots = copyDirectory(join(root, 'screenshots'), join(out, 'screenshots'), false);
  if (shots.length < 3) {
    process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
    return 1;
  }
  for (const name of shots) {
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(name)) {
      process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
      return 1;
    }
  }
  writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: 65536, screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } }));
  process.stdout.write(`token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored; wrote board.json, data.js, dashboard (${dashboard.length} files), screenshots (${shots.length} images) and dossier.json\n`);
  return 0;
}
try { process.exitCode = run(); }
catch (error) {
  process.stderr.write(`token radar: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
