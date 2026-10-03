const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../src');
function createServer() {
  return http.createServer((req, res) => {
    let url; try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const file = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' }[path.extname(file)] || 'application/octet-stream');
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'");
      res.end(data);
    });
  });
}
module.exports = createServer;
if (require.main === module) createServer().listen(Number(process.env.PORT || 8772), '127.0.0.1', () => console.log('Water Garden: http://127.0.0.1:' + (process.env.PORT || 8772)));
