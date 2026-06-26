// print-server.js -- ESC/POS local print server for Windows 7+
var http  = require('http');
var fs    = require('fs');
var path  = require('path');
var os    = require('os');
var exec  = require('child_process').exec;

var PORT         = 3001;
var PRINTER_NAME = process.env.PRINTER_NAME || 'Kassa';
var EXE_PATH     = path.join(os.tmpdir(), 'kc_print.exe');

var ESC = 0x1B;
var GS  = 0x1D;

// Pre-compiled RAW-print helper (embedded as base64)
var EXE_B64 = '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bmREb2NQcmludGVyAFN0YXJ0UGFnZVByaW50ZXIARW5kUGFnZVByaW50ZXIAV3JpdGVQcmludGVyAE1haW4ALmN0b3IAcFByaW50ZXJOYW1lAHBoUHJpbnRlcgBTeXN0ZW0uUnVudGltZS5JbnRlcm9wU2VydmljZXMAT3V0QXR0cmlidXRlAHBEZWZhdWx0AGhQcmludGVyAExldmVsAHBEb2NJbmZvAHBCdWYAY2JCdWYAcGNXcml0dGVuAGFyZ3MAU3lzdGVtLlJ1bnRpbWUuQ29tcGlsZXJTZXJ2aWNlcwBDb21waWxhdGlvblJlbGF4YXRpb25zQXR0cmlidXRlAFJ1bnRpbWVDb21wYXRpYmlsaXR5QXR0cmlidXRlAGtjX3ByaW50AERsbEltcG9ydEF0dHJpYnV0ZQB3aW5zcG9vbC5kcnYAQ29uc29sZQBXcml0ZUxpbmUARW52aXJvbm1lbnQARXhpdABTeXN0ZW0uSU8ARmlsZQBSZWFkQWxsQnl0ZXMASW50UHRyAFplcm8ATWFyc2hhbABHZXRMYXN0V2luMzJFcnJvcgBJbnQzMgBTdHJpbmcAQ29uY2F0AFN0cmluZ1RvSEdsb2JhbFVuaQBnZXRfU2l6ZQBBbGxvY0hHbG9iYWwAV3JpdGVJbnRQdHIARnJlZUhHbG9iYWwAABFFAFIAUgA6AGEAcgBnAHMAACFFAFIAUgA6AE8AcABlAG4AUAByAGkAbgB0AGUAcgA6AAAZSwBpAHQAYwBoAGUAbgBPAHIAZABlAHIAAAdSAEEAVwAAG0UAUgBSADoAUwB0AGEAcgB0AEQAbwBjADoAAAVPAEsAABVFAFIAUgA6AHcAcgBvAHQAZQAgAAADLwAAAE2ZN4vTvqVPunL9XMcnTo8ACLd6XFYZNOCJBwADAg4QGBgEAAECGAYAAwgYCBgJAAQCGB0FCBAIBQABAR0OAyAAAQQgAQEIBCABAQ4EAAEBDgQAAQEIBQABHQUOAgYYAwAACAUAAg4cHAQAARgOBAABGAgGAAMBGAgYBAABARgFAAEOHRwNBwkOHQUYGBgYCAgdHAgBAAgAAAAAAB4BAAEAVAIWV3JhcE5vbkV4Y2VwdGlvblRocm93cwEAhCgAAAAAAAAAAAAAnigAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJAoAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAwAAACwOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function ensureExe() {
  var buf = Buffer.from(EXE_B64, 'base64');
  fs.writeFileSync(EXE_PATH, buf);
  console.log('   kc_print.exe -> ' + EXE_PATH);
}

function rawPrint(filePath, printerName, cb) {
  ensureExe();
  var cmd = '"' + EXE_PATH + '" "' + printerName + '" "' + filePath + '"';
  exec(cmd, { timeout: 10000 }, function(err, stdout, stderr) {
    var out = (stdout || '').trim();
    if (out === 'OK') { cb(null); return; }
    cb(new Error(out || (stderr || '').trim() || (err && err.message) || 'unknown'));
  });
}

// Active encoding — change to 'cp1251' if Cyrillic prints as garbage
var ENCODING = process.env.ENCODING || 'cp866';

function toCP866(s) {
  var buf = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) { buf.push(c); continue; }
    if (c >= 0x0410 && c <= 0x042F) { buf.push(c - 0x0410 + 0x80); continue; }
    if (c >= 0x0430 && c <= 0x043F) { buf.push(c - 0x0430 + 0xA0); continue; }
    if (c >= 0x0440 && c <= 0x044F) { buf.push(c - 0x0440 + 0xE0); continue; }
    if (c === 0x0401) { buf.push(0xF0); continue; }
    if (c === 0x0451) { buf.push(0xF1); continue; }
    if (c === 0x2116) { buf.push(0xFC); continue; }
    if (c === 0x2014 || c === 0x2013) { buf.push(0x2D); continue; }
    buf.push(0x3F);
  }
  return Buffer.from(buf);
}
function toCP1251(s) {
  var buf = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) { buf.push(c); continue; }
    if (c >= 0x0410 && c <= 0x042F) { buf.push(c - 0x0410 + 0xC0); continue; }
    if (c >= 0x0430 && c <= 0x044F) { buf.push(c - 0x0430 + 0xE0); continue; }
    if (c === 0x0401) { buf.push(0xA8); continue; }
    if (c === 0x0451) { buf.push(0xB8); continue; }
    if (c === 0x2116) { buf.push(0xB9); continue; }
    if (c === 0x2014 || c === 0x2013) { buf.push(0x2D); continue; }
    buf.push(0x3F);
  }
  return Buffer.from(buf);
}
function toCP862(s) {
  var buf = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) { buf.push(c); continue; }
    // Hebrew Unicode 0x05D0-0x05EA → CP862 0x80-0x9A
    if (c >= 0x05D0 && c <= 0x05EA) { buf.push(c - 0x05D0 + 0x80); continue; }
    buf.push(0x3F);
  }
  return Buffer.from(buf);
}
function encode(s) { return ENCODING === 'cp1251' ? toCP1251(s) : toCP866(s); }
function txt(s) { return Buffer.concat([encode(s), Buffer.from([0x0A])]); }
function cmd()  { return Buffer.from(Array.prototype.slice.call(arguments)); }

// sectionTitle: optional header line (e.g. '== МAФИЯ =='), null for full order
function buildEscPos(o, sectionTitle) {
  var allItems = o.items || [];
  var items = sectionTitle
    ? allItems.filter(function(it) { return String(it.category || '').trim() === sectionTitle.cat; })
    : allItems;
  var SEP   = '================================';
  var LINE  = '--------------------------------';
  var now   = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
  var total = 0;

  var itemRows = items.map(function(it) {
    total += Number(it.qty) || 0;
    var name = String(it.name || '').substring(0, 22);
    while (name.length < 22) name += ' ';
    var qty = String(it.qty || 1);
    while (qty.length < 4) qty = ' ' + qty;
    return txt(name + qty);
  });

  var parts = [
    cmd(ESC, 0x40),
    cmd(ESC, 0x74, 0x07),
    cmd(ESC, 0x61, 0x01),
    cmd(ESC, 0x21, 0x10),
    txt('ZAKAZ #' + (o.order_number || '-')),
    cmd(ESC, 0x21, 0x00),
  ];
  if (sectionTitle) parts.push(txt(sectionTitle.label));
  if (o.order_type) parts.push(txt(o.order_type));
  parts.push(txt(SEP));
  parts.push(cmd(ESC, 0x61, 0x00));
  parts.push(txt('Klient: '  + (o.customer || '-')));
  if (o.date) parts.push(txt('Data:   ' + o.date));
  if (o.time) parts.push(txt('Vremja: ' + o.time));
  parts.push(txt(LINE));
  parts.push(cmd(ESC, 0x61, 0x01));
  parts.push(txt(sectionTitle ? sectionTitle.label : '  VSE BLYUDA  '));
  parts.push(cmd(ESC, 0x61, 0x00));
  parts.push(txt(LINE));
  itemRows.forEach(function(r) { parts.push(r); });
  parts.push(txt(LINE));
  parts.push(txt('Itogo: ' + total + ' pors.'));
  if (o.kitchen_notes)    { parts.push(txt(LINE)); parts.push(txt('Kukhne: '   + o.kitchen_notes)); }
  if (o.delivery_address) { parts.push(txt(LINE)); parts.push(txt('Dostavka: ' + o.delivery_address)); }
  parts.push(txt(SEP));
  parts.push(cmd(ESC, 0x61, 0x01));
  parts.push(txt(now));
  parts.push(txt('')); parts.push(txt(''));
  parts.push(cmd(GS, 0x56, 0x42, 0x00));
  return Buffer.concat(parts);
}

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, printer: PRINTER_NAME }));
    return;
  }

  if (req.method === 'GET' && req.url === '/test') {
    // Encoding test: Russian (all combos) + Hebrew (CP862 with various ESC t)
    var LF    = Buffer.from([0x0A]);
    var c866  = toCP866('Привет');
    var c1251 = toCP1251('Привет');
    var cHeb  = toCP862('שלום');
    var ruTests = [
      [0x00, c866,  'RU t00+866'],
      [0x07, c866,  'RU t07+866 *'],
      [0x0E, c866,  'RU t0E+866'],
      [0x11, c866,  'RU t11+866'],
      [0x12, c1251, 'RU t12+1251'],
      [0x17, c866,  'RU t17+866'],
      [0x23, c1251, 'RU t23+1251'],
    ];
    var hebTests = [
      [0x0D, cHeb, 'HE t0D+862'],
      [0x0F, cHeb, 'HE t0F+862'],
      [0x11, cHeb, 'HE t11+862'],
      [0x00, cHeb, 'HE t00+862'],
    ];
    var parts = [ Buffer.from('--- RUSSIAN ---\n') ];
    parts.push(Buffer.from('noESCt: ')); parts.push(c866); parts.push(LF);
    ruTests.forEach(function(t) {
      parts.push(Buffer.from([ESC, 0x74, t[0]]));
      parts.push(Buffer.from(t[2] + ': ')); parts.push(t[1]); parts.push(LF);
    });
    parts.push(Buffer.from('--- HEBREW ---\n'));
    hebTests.forEach(function(t) {
      parts.push(Buffer.from([ESC, 0x74, t[0]]));
      parts.push(Buffer.from(t[2] + ': ')); parts.push(t[1]); parts.push(LF);
    });
    parts.push(Buffer.from('\n\n'));
    parts.push(Buffer.from([GS, 0x56, 0x42, 0x00]));
    var buf = Buffer.concat(parts);
    var tmpFile = path.join(os.tmpdir(), 'kc_test.bin');
    fs.writeFileSync(tmpFile, buf);
    rawPrint(tmpFile, PRINTER_NAME, function(err) {
      if (err) {
        console.error('Test error:', err.message);
        res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
      } else {
        res.writeHead(200); res.end(JSON.stringify({ ok: true, printer: PRINTER_NAME }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    var body = '';
    req.on('data', function(d) { body += d; });
    req.on('end', function() {
      try {
        var order = JSON.parse(body);
        var items = order.items || [];

        // Collect unique non-empty categories from items
        var seenCats = {};
        var sectionsToprint = [];
        items.forEach(function(it) {
          var cat = String(it.category || '').trim();
          if (cat && !seenCats[cat]) {
            seenCats[cat] = true;
            sectionsToprint.push({ cat: cat, label: '== ' + cat + ' ==' });
          }
        });

        // Full receipt first, then one per category
        var receipts = [{ buf: buildEscPos(order, null), label: 'full' }];
        sectionsToprint.forEach(function(sec) {
          receipts.push({ buf: buildEscPos(order, sec), label: sec.label });
        });

        function printNext(i) {
          if (i >= receipts.length) {
            console.log('Printed ' + receipts.length + ' receipts for order #' + order.order_number);
            res.writeHead(200); res.end(JSON.stringify({ ok: true, receipts: receipts.length }));
            return;
          }
          var tmpFile = path.join(os.tmpdir(), 'kc_receipt_' + i + '.bin');
          fs.writeFileSync(tmpFile, receipts[i].buf);
          rawPrint(tmpFile, PRINTER_NAME, function(err) {
            if (err) {
              console.error('Print error receipt ' + i + ':', err.message);
              res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
            } else {
              printNext(i + 1);
            }
          });
        }
        printNext(0);

      } catch(e) {
        res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(PORT, '127.0.0.1', function() {
  console.log('\nPrint server -> http://localhost:' + PORT);
  console.log('   Printer: ' + PRINTER_NAME);
  ensureExe();
  console.log('   Ready! Press Ctrl+C to stop.\n');
});