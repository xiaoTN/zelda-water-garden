const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
function run(command, args, cwd = root) { const result = spawnSync(command, args, { cwd, stdio: 'inherit' }); if (result.error) throw result.error; if (result.status !== 0) process.exit(result.status || 1); }
run(process.execPath, ['scripts/bundle-physics.cjs']);
run(process.execPath, ['scripts/bundle-audio.cjs']);
run(process.execPath, ['--test', 'tests/water.test.cjs']);
run(process.execPath, ['scripts/verify-package.cjs']);
run(process.execPath, ['scripts/audit-artifact.mjs', 'src']);
const version = require('../package.json').version;
const out = path.join(root, 'artifacts'); fs.mkdirSync(out, { recursive: true });
const zip = path.join(out, 'zelda-water-garden-minitool-v' + version + '.zip');
if (fs.existsSync(zip)) fs.unlinkSync(zip);
if (process.platform === 'win32') {
  const quote = text => "'" + text.replace(/'/g, "''") + "'";
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Compress-Archive -Path ' + quote(path.join(root, 'src', '*')) + ' -DestinationPath ' + quote(zip) + ' -Force']);
} else run('zip', ['-q', '-r', zip, '.'], path.join(root, 'src'));
require('./verify-zip.cjs')(zip);
run(process.execPath, ['scripts/audit-artifact.mjs', zip]);
const manifest = { version, file: path.basename(zip), bytes: fs.statSync(zip).size, entries: fs.readdirSync(path.join(root, 'src')).length, sha256: crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex') };
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
