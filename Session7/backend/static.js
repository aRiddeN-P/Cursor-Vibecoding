// vibe-kahoot static frontend server (PORT_FRONT)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const http = require('http');
const serveStatic = require('serve-static');

const PORT = parseInt(process.env.PORT_FRONT || '3001', 10);
const root = path.join(__dirname, '..', 'frontend');
const serve = serveStatic(root, { index: ['index.html'], extensions: ['html'] });

const server = http.createServer((req, res) => {
  serve(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('404 Not Found');
  });
});
server.listen(PORT, () => console.log(`[static] serving ${root} on http://localhost:${PORT}`));
