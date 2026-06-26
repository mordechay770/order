// print-server.js — ESC/POS local print server for Windows 7+
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const { exec } = require('child_process');

const PORT         = 3001;
const PRINTER_NAME = process.env.PRINTER_NAME || 'Kassa';

const ESC = 0x1B;
const GS  = 0x1D;

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

function txt(s) { return Buffer.concat([toCP866(s), Buffer.from([0x0A])]); }
function cmd() { return Buffer.from(Array.prototype.slice.call(arguments)); }

function buildEscPos(o) {
  var items = o.items || [];
  var SEP   = '================================';
  var LINE  = '--------------------------------';
  var tz    = 'Asia/Almaty';
  var now   = new Date().toLocaleString('ru-RU', { timeZone: tz });
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
    cmd(ESC, 0x74, 0x11),
    cmd(ESC, 0x61, 0x01),
    cmd(ESC, 0x21, 0x10),
    txt('ZAKAZ #' + (o.order_number || '-')),
    cmd(ESC, 0x21, 0x00),
  ];
  if (o.order_type) parts.push(txt(o.order_type));
  parts.push(txt(SEP));
  parts.push(cmd(ESC, 0x61, 0x00));
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
  parts.push(txt('Itogo: ' + total));
  if (o.kitchen_notes)    { parts.push(txt(LINE)); parts.push(txt('Kukhne: '    + o.kitchen_notes)); }
  if (o.delivery_address) { parts.push(txt(LINE)); parts.push(txt('Dostavka: '  + o.delivery_address)); }
  parts.push(txt(SEP));
  parts.push(cmd(ESC, 0x61, 0x01));
  parts.push(txt(now));
  parts.push(txt('')); parts.push(txt(''));
  parts.push(cmd(GS, 0x56, 0x42, 0x00));
  return Buffer.concat(parts);
}

// Send raw bytes to printer via Windows Spooler API (bypasses driver rendering)
function rawPrint(filePath, printerName, cb) {
  var ps = [
    '$file = "' + filePath.replace(/\\/g, '\\\\') + '"',
    '$printer = "' + printerName + '"',
    '$bytes = [System.IO.File]::ReadAllBytes($file)',
    'Add-Type -TypeDefinition @\'',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class WinPrint {',
    '  [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)]',
    '  public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr d);',
    '  [DllImport("winspool.drv",SetLastError=true)]',
    '  public static extern bool ClosePrinter(IntPtr h);',
    '  [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)]',
    '  public static extern int StartDocPrinter(IntPtr h,int l,int[] di);',
    '  [DllImport("winspool.drv",SetLastError=true)]',
    '  public static extern bool EndDocPrinter(IntPtr h);',
    '  [DllImport("winspool.drv",SetLastError=true)]',
    '  public static extern bool StartPagePrinter(IntPtr h);',
    '  [DllImport("winspool.drv",SetLastError=true)]',
    '  public static extern bool EndPagePrinter(IntPtr h);',
    '  [DllImport("winspool.drv",SetLastError=true)]',
    '  public static extern bool WritePrinter(IntPtr h,byte[] b,int c,out int w);',
    '}',
    '\'@',
    '$h=[IntPtr]::Zero',
    'if(-not [WinPrint]::OpenPrinter($printer,[ref]$h,[IntPtr]::Zero)){Write-Host "ERR:OpenPrinter";exit 1}',
    // DOCINFO as array: [size, pDocName ptr, pOutputFile ptr, pDatatype ptr]
    // Use simpler approach with PrintDocument
    // Actually use direct WritePrinter after marshaling DOCINFO manually
    // Simplest: use net start/stop or just try a different approach
    // Use the RAW data type string
    '$docName = [System.Runtime.InteropServices.Marshal]::StringToHGlobalUni("KitchenOrder")',
    '$dataType = [System.Runtime.InteropServices.Marshal]::StringToHGlobalUni("RAW")',
    '$diSize = [System.Runtime.InteropServices.Marshal]::SizeOf([System.IntPtr]) * 3 + 4',
    // Skip complex DOCINFO, use simpler PowerShell approach
    '[WinPrint]::ClosePrinter($h)',
    // Use System.Drawing.Printing instead
    'Write-Host "SKIP"',
  ].join('\n');

  // Simpler: use net use / rundll32 approach... actually use System.Printing namespace
  // Most reliable on Win7: use the spooler via a small C# inline script
  var psScript = [
    '$printerName = "' + printerName + '"',
    '$filePath = "' + filePath.replace(/\\/g, '\\\\') + '"',
    '$rawData = [System.IO.File]::ReadAllBytes($filePath)',
    'Add-Type -AssemblyName System.Drawing',
    '$src = @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class RawPrinter {',
    '  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]',
    '  public struct DOCINFOW { public int cbSize; public string pDocName; public string pOutputFile; public string pDatatype; public int fwType; }',
    '  [DllImport("winspool.drv",CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr d);',
    '  [DllImport("winspool.drv")] public static extern bool ClosePrinter(IntPtr h);',
    '  [DllImport("winspool.drv",CharSet=CharSet.Unicode)] public static extern int StartDocPrinter(IntPtr h,int l,ref DOCINFOW d);',
    '  [DllImport("winspool.drv")] public static extern bool EndDocPrinter(IntPtr h);',
    '  [DllImport("winspool.drv")] public static extern bool StartPagePrinter(IntPtr h);',
    '  [DllImport("winspool.drv")] public static extern bool EndPagePrinter(IntPtr h);',
    '  [DllImport("winspool.drv")] public static extern bool WritePrinter(IntPtr h,byte[] b,int c,out int w);',
    '  public static bool Print(string printer, byte[] data) {',
    '    IntPtr h; if(!OpenPrinter(printer,out h,IntPtr.Zero)) return false;',
    '    var di = new DOCINFOW { cbSize=20, pDocName="Order", pDatatype="RAW" };',
    '    if(StartDocPrinter(h,1,ref di)<1){ClosePrinter(h);return false;}',
    '    StartPagePrinter(h);',
    '    int w; WritePrinter(h,data,data.Length,out w);',
    '    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);',
    '    return w==data.Length;',
    '  }',
    '}',
    '"@',
    'Add-Type -TypeDefinition $src',
    'if([RawPrinter]::Print($printerName,$rawData)){Write-Host "OK"}else{Write-Host "ERR";exit 1}',
  ].join('\n');

  var tmpPs = path.join(os.tmpdir(), 'kc_print.ps1');
  fs.writeFileSync(tmpPs, psScript, 'utf8');

  exec('powershell.exe -ExecutionPolicy Bypass -File "' + tmpPs + '"', function(err, stdout, stderr) {
    if (err || (stdout && stdout.indexOf('ERR') >= 0)) {
      cb(new Error('PowerShell error: ' + (stderr || stdout || (err && err.message))));
    } else if (stdout && stdout.indexOf('OK') >= 0) {
      cb(null);
    } else {
      cb(new Error('Unknown result: ' + stdout));
    }
  });
}

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200); res.end(JSON.stringify({ ok: true, printer: PRINTER_NAME })); return;
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
        rawPrint(tmpFile, PRINTER_NAME, function(err) {
          if (err) {
            console.error('Print error:', err.message);
            res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
          } else {
            console.log('Printed order #' + order.order_number);
            res.writeHead(200); res.end(JSON.stringify({ ok: true }));
          }
        });
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
  console.log('   Printer name: ' + PRINTER_NAME);
  console.log('   Press Ctrl+C to stop\n');
});
