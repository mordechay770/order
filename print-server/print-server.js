// print-server.js — ESC/POS local print server
// Runs on chef's PC, listens on localhost:3001
// Receives order JSON → sends ESC/POS to USB002 printer port

const http = require('http');
const { execFile } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT      = 3001;
const PRINTER   = 'USB002'; // Windows printer port name

const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

function txt(s)     { return Buffer.from(s + '\n', 'cp866'); }
function cmd(...b)  { return Buffer.from(b); }

function buildEscPos(o) {
  const items = o.items || [];
  const SEP   = '================================';
  const LINE  = '--------------------------------';
  const tz    = 'Asia/Almaty';
  const now   = new Date().toLocaleString('ru-RU', { timeZone: tz });

  let total = 0;
  const itemRows = items.map(it => {
    total += Number(it.qty) || 0;
    const name = String(it.name || '').substring(0, 22).padEnd(22);
    const qty  = String(it.qty || 1).padStart(4);
    return txt(`${name}${qty}`);
  });

  return Buffer.concat([
    cmd(ESC, 0x40),           // init
    cmd(ESC, 0x61, 0x01),     // center
    cmd(ESC, 0x21, 0x10),     // double-height
    txt(`ЗАКАЗ №${o.order_number || '—'}`),
    cmd(ESC, 0x21, 0x00),     // normal
    o.order_type ? txt(o.order_type) : Buffer.alloc(0),
    txt(SEP),
    cmd(ESC, 0x61, 0x00),     // left
    txt(`Клиент: ${o.customer || '—'}`),
    txt(`Дата:   ${o.date   || ''}`),
    txt(`Время:  ${o.time   || ''}`),
    txt(LINE),
    cmd(ESC, 0x61, 0x01),
    txt('  СОСТАВ ЗАКАЗА  '),
    cmd(ESC, 0x61, 0x00),
    txt(LINE),
    ...itemRows,
    txt(LINE),
    txt(`Итого порций:              ${String(total).padStart(4)}`),
    o.kitchen_notes ? Buffer.concat([txt(LINE), txt(`Кухне: ${o.kitchen_notes}`)]) : Buffer.alloc(0),
    o.delivery_address ? Buffer.concat([txt(LINE), txt(`Доставка: ${o.delivery_address}`)]) : Buffer.alloc(0),
    txt(SEP),
    cmd(ESC, 0x61, 0x01),
    txt(now),
    txt(''),
    txt(''),
    cmd(GS, 0x56, 0x42, 0x00), // full cut
  ]);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200); res.end(JSON.stringify({ ok: true, port: PRINTER })); return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const order  = JSON.parse(body);
        const buf    = buildEscPos(order);
        const tmpFile = path.join(os.tmpdir(), 'kc_receipt.bin');
        fs.writeFileSync(tmpFile, buf);

        // Windows: copy /b file USB002  — sends raw bytes directly to printer port
        execFile('cmd.exe', ['/c', `copy /b "${tmpFile}" ${PRINTER}`], (err, stdout, stderr) => {
          if (err) {
            console.error('Print error:', err.message);
            res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
          } else {
            console.log(`Printed order #${order.order_number}`);
            res.writeHead(200); res.end(JSON.stringify({ ok: true }));
          }
        });
      } catch (e) {
        res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅ Print server ready → http://localhost:${PORT}`);
  console.log(`   Printer port: ${PRINTER}`);
  console.log('   Press Ctrl+C to stop\n');
});
