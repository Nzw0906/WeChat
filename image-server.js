const http = require('http');
const fs = require('fs');
const path = require('path');

const majorArcanaDir = path.join(__dirname, 'images_backup', 'tarot');
const minorArcanaDir = path.join(__dirname, 'cards');

const minorArcanaMapping = {
  'wands': 'w', 'cups': 'c', 'swords': 's', 'pentacles': 'p'
};

function getMinorArcanaFile(requestName) {
  const filename = path.basename(requestName, '.jpg');
  const parts = filename.split('_');
  if (parts.length !== 2) return null;

  const suit = minorArcanaMapping[parts[0]];
  if (!suit) return null;

  let numStr = parts[1];
  const rankMap = { 'ace': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10', 'page': '11', 'knight': '12', 'queen': '13', 'king': '14' };
  const num = rankMap[numStr];
  if (!num) return null;

  return `${suit}${num}.jpg`;
}

const server = http.createServer((req, res) => {
  let filePath;
  let requestPath = req.url.slice(1);

  const isMinorArcana = requestPath.includes('_');

  if (isMinorArcana) {
    const mappedFile = getMinorArcanaFile(requestPath);
    if (mappedFile) {
      filePath = path.join(minorArcanaDir, mappedFile);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(minorArcanaDir, requestPath);
      }
    } else {
      filePath = path.join(minorArcanaDir, requestPath);
    }
  } else {
    filePath = path.join(majorArcanaDir, requestPath);
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found: ' + filePath);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif'
  }[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Image server running on http://localhost:${PORT}`);
});