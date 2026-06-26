// print-server.js — ESC/POS local print server
// Runs on chef's PC, listens on localhost:3001
// Receives order JSON → sends ESC/POS to USB002 printer port

const http = require('http');
const { execFile } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT    = 3001;
const PRINTER = process.env.PRINTER_PORT || 'USB002';

const ESC = 0x1B;
const GS  = 0x1D;

// Manual UTF-8 → CP866 conversion (no iconv needed)
function toCP866(s) {
  const buf = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) { buf.push(c); continue; }
    if (c >= 0x0410 && c <= 0x042F) { buf.push(c - 0x0410 + 0x80); continue; } // А-Я
    if (c >= 0x0430 && c <= 0x043F) { buf.push(c - 0x0430 + 0xA0); continue; } // а-п
    if (c >= 0x0440 && c <= 0x044F) { buf.push(c - 0x0440 + 0xE0); continue; } // р-я
    if (c === 0x0401) { buf.push(0xF0); continue; } // Ё
    if (c === 0x0451) { buf.push(0xF1); continue; } // ё
    if (c === 0x2116) { buf.push(0xFC); continue; } // №
    if (c === 0x2014 || c === 0x2013) { buf.push(0x2D); continue; } // — → -
    buf.push(0x3F); // unknown → ?
  }
  return Buffer.from(buf);
}

function txt(s) { return Buffer.concat([toCP866(s), Buffer.from([0x0A])]); }
function cmd() { return Buffer.from(Array.prototype.slice.call(arguments)); }

function buildEscPos(o) {
  const items = o.items || [];
  const SEP   = '================================';
  const LINE  = '--------------------------------';
  const tz    = 'Asia/Almaty';
  const now   = new Date().toLocaleString('ru-RU', { timeZone: tz });

  let total = 0;
  const itemRows = items.map(function(it) {
    total += Number(it.qty) || 0;
    var name = String(it.name || '').substring(0, 22);
    while (name.length < 22) name += ' ';
    var qty = String(it.qty || 1);
    while (qty.length < 4) qty = ' ' + qty;
    return txt(name + qty);
  });

  var parts = [
    cmd(ESC, 0x40),        // init
    cmd(ESC, 0x74, 0x11),  // select CP866 code page
    cmd(ESC, 0x61, 0x01),  // center
    cmd(ESC, 0x21, 0x10),  // double-height
    txt('ZAKAZ #' + (o.order_number || '-')),
    cmd(ESC, 0x21, 0x00),  // normal
  ];
  if (o.order_type) parts.push(txt(o.order_type));
  parts.push(txt(SEP));
  parts.push(cmd(ESC, 0x61, 0x00)); // left
  parts.push(txt('Klient: ' + (o.customer || '-')));
  if (o.date) parts.push(txt('Data:   ' + o.date));
  if (o.time) parts.push(txt('Vremja: ' + o.time));
  parts.push(txt(LINE));
  parts.push(cmd(ESC, 0x61, 0x01));
  parts.push(txt('  SOSTAV ZAKAZA  '));
  parts.push(cmd(ESC, 0x61, 0x00));
  parts.push(txt(LINE));
  itemRows.forEach(function(r) { parts.push(r); });
  parts.push(txt(LINE));
  parts.push(txt('Itogoorcij: ' + total));
  if (o.kitchen_notes) { parts.push(txt(LINE)); parts.push(txt('Kukhne: ' + o.kitchen_notes)); }
  if (o.delivery_address) { parts.push(txt(LINE)); parts.push(txt('Dostavka: ' + o.delivery_address)); }
  parts.push(txt(SEP));
  parts.push(cmd(ESC, 0x61, 0x01));
  parts.push(txt(now));
  parts.push(txt(''));
  parts.push(txt(''));
  parts.push(cmd(GS, 0x56, 0x42, 0x00)); // full cut

  return Buffer.concat(parts);
}

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200); res.end(JSON.stringify({ ok: true, port: PRINTER })); return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    var body = '';
    req.on('data', function(d) { body += d; });
    req.on('end', function() {
      try {
        var order   = JSON.parse(body);
        var buf     = buildEscPos(order);
        var tmpFile = path.join(os.tmpdir(), 'kc_receipt.bin');
        fs.writeFileSync(tmpFile, buf);

        var ports = [PRINTER, 'USB001', 'USB002', 'USB003', 'USB004'];
        // remove duplicates
        var seen = {}; ports = ports.filter(function(p) { if (seen[p]) return false; seen[p]=true; return true; });
        var tried = 0;
        function tryPort(port) {
          execFile('cmd.exe', ['/c', 'copy /b "' + tmpFile + '" ' + port], function(err, stdout) {
            if (!err && stdout && stdout.indexOf('1') >= 0) {
              console.log('Printed order #' + order.order_number + ' -> ' + port);
              res.writeHead(200); res.end(JSON.stringify({ ok: true, port: port }));
            } else if (++tried < ports.length) {
              tryPort(ports[tried]);
            } else {
              var msg = 'Failed on all ports: ' + ports.join(',');
              console.error(msg);
              res.writeHead(500); res.end(JSON.stringify({ error: msg }));
            }
          });
        }
        tryPort(ports[0]);
      } catch(e) {
        res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, '127.0.0.1', function() {
  console.log('\nPrint server ready -> http://localhost:' + PORT);
  console.log('   Printer port: ' + PRINTER);
  console.log('   Press Ctrl+C to stop\n');
});
