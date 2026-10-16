const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 5173;
const publicDirectory = path.join(__dirname, 'public');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

http.createServer((request, response) => {
  const cleanUrl = decodeURIComponent(request.url.split('?')[0]);
  const requestedPath = cleanUrl === '/' ? '/index.html' : cleanUrl;
  const filePath = path.normalize(path.join(publicDirectory, requestedPath));

  if (!filePath.startsWith(publicDirectory)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }

    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'text/plain; charset=utf-8' });
    response.end(content);
  });
}).listen(port, () => {
  console.log(`Branding Trans Jogja berjalan di http://localhost:${port}`);
});
