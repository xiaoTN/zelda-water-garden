const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const root = path.resolve(__dirname, '..'), src = path.join(root, 'src');
const allowed = new Set(['.html','.js','.css','.png','.jpg','.jpeg','.webp','.svg','.json','.woff','.woff2','.gif']);
const files = fs.readdirSync(src);
assert(files.includes('index.html'), 'root index.html missing');
assert.equal(files.filter(x => x.endsWith('.html')).length, 1);
let total = 0;
for (const file of files) {
  assert(allowed.has(path.extname(file)), 'unsupported file: ' + file);
  const bytes = fs.readFileSync(path.join(src, file)); total += bytes.length;
  if (!/\.(?:js|html|css|json|svg)$/.test(file)) continue;
  const text = bytes.toString('utf8');
  assert(!/https?:\/\/|url\(\s*['"]?\/\//.test(text), 'external URL in ' + file);
  assert(!/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker|WebAssembly|eval\s*\(|new\s+Function|requestFullscreen|clipboard|geolocation|window\.open\s*\(|window\.prompt\s*\(|serviceWorker)/.test(text), 'forbidden capability in ' + file);
  if (file.endsWith('.js')) {
    new vm.Script(text, { filename: file });
    assert(!/\?\.|\?\?|\b(?:import|export)\s|\b(?:replaceAll|structuredClone)\s*\(/.test(text), 'post ES2017 syntax or module in ' + file);
  }
}
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
assert(/<!DOCTYPE html>/i.test(html) && /lang="zh-CN"/.test(html) && /charset="UTF-8"/.test(html));
assert(/viewport-fit=cover/.test(html));
assert(!/<(?:iframe|object|base)\b|\bon\w+\s*=|javascript:|type="module"|http-equiv="Content-Security-Policy"/i.test(html));
for (const tag of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/g) || []) assert(/^<script src="\.\/[^"<>]+"><\/script>$/.test(tag), 'inline or non-classic script');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) { assert(match[1].startsWith('./')); assert(fs.existsSync(path.join(src, match[1]))); }
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
assert(!/\bgap\s*:|\baspect-ratio\s*:|\bclamp\s*\(|\bcolor-mix\s*\(|:has\s*\(|\b(?:dvh|svh)\b/.test(css));
const app = fs.readFileSync(path.join(src, 'app.js'), 'utf8');
for (const match of app.matchAll(/getElementById\('([^']+)'\)/g)) assert(html.includes('id="' + match[1] + '"'), 'missing DOM ID ' + match[1]);
assert(app.includes('webglcontextlost') && app.includes('webglcontextrestored') && app.includes('visibilitychange') && app.includes('slowFrames'));
assert(total < 5 * 1024 * 1024);
for (const name of ['water-normal.png','water-foam.png']) {
  const png = fs.readFileSync(path.join(src,name));
  assert.equal(png.readUInt32BE(16),256); assert.equal(png.readUInt32BE(20),256);
}
console.log('Package checks passed: ' + files.length + ' offline files, classic scripts, CSP capabilities, DOM bindings, baseline CSS, WebGL degradation.');
