# Thermal Printer — ESC/POS Setup for Kitchen Orders

## Hardware

| פרט | ערך |
|-----|-----|
| דגם | AP80 (מדפסת סינית, 80mm) |
| חיבור | USB → Windows 7 |
| שם מדפסת ב-Windows | `Kassa` |
| פרוטוקול | ESC/POS |
| Code page ברירת מחדל | CP866 (Cyrillic) |
| Code page לעברית | CP862 (Hebrew) |
| ESC t לרוסית | `0x07` + CP866 encoding |
| ESC t לעברית | `0x0F` + CP862 encoding |

## ממצאי Encoding (ניסויים)

בוצע test receipt עם 10 שילובים. התוצאות:

| שילוב | תוצאה |
|--------|--------|
| noESCt + CP866 | ❌ |
| ESC t 0x00 + CP866 | ❌ |
| **ESC t 0x07 + CP866** | ✅ רוסית עובדת |
| ESC t 0x0E + CP866 | ❌ |
| ESC t 0x11 + CP866 | ❌ |
| ESC t 0x12 + CP1251 | ❌ |
| ESC t 0x17 + CP866 | ❌ |
| ESC t 0x23 + CP1251 | ❌ |
| **ESC t 0x0F + CP862** | ✅ עברית עובדת (LTR — צריך היפוך ידני) |

## ארכיטקטורת הדפסה

```
chef.html (Vercel HTTPS)
    ↓ fetch POST
http://localhost:3001/print
    ↓ Node.js print-server.js
kc_print.exe (C#, RAW via winspool.drv)
    ↓ Windows Spooler API
מדפסת "Kassa"
```

## קבצים

| קובץ | תיאור |
|------|--------|
| `kitchen-orders/print-server/print-server.js` | שרת Node.js מקומי — לוגיקת ESC/POS, encoding, routes |
| `kitchen-orders/print-server/kc_print.exe` | C# helper pre-compiled — שולח RAW data ל-Windows Spooler |
| `kitchen-orders/print-server/start.bat` | הפעלת השרת |
| `kitchen-orders/src/chef.html` | מכיל `JS_B64` — base64 של print-server.js |

## Self-Install Flow (ללא העברת קבצים ידנית)

1. השף פותח `chef.html` בדפדפן
2. לוחץ **"הורד Node.js"** — מוריד Node v12.22.12 (אחרון עם Windows 7 support)
3. לוחץ **"הורד Print Server"** — chef.html מייצר:
   - `setup_print_server.bat` — מפענח base64 + מריץ
   - `decode.vbs` — ADODB.Stream לפענוח binary מ-base64 ב-Windows 7
   - `print-server.js` מחולץ מ-`JS_B64` שמוטמע ב-chef.html
4. `kc_print.exe` מחולץ אוטומטית מ-`EXE_B64` שמוטמע ב-print-server.js בכל הפעלה

## עדכון גרסה (למפתח)

כשמשנים `print-server.js`:
```powershell
$bytes = [System.IO.File]::ReadAllBytes("kitchen-orders/print-server/print-server.js")
$b64 = [System.Convert]::ToBase64String($bytes)
# הדבק את $b64 ב-const JS_B64 = '...' בchef.html
```
או עם PowerShell regex אוטומטי (כמו שנעשה בשיחה זו).

## Routes של print-server.js

| Route | Method | תיאור |
|-------|--------|--------|
| `/ping` | GET | בדיקת חיות — מחזיר `{ok:true, printer:"Kassa"}` |
| `/test` | GET | מדפיס קבלת encoding test (Russian+Hebrew combos) |
| `/print` | POST | מדפיס הזמנה |

### POST /print — Payload

```json
{
  "order_number": 42,
  "order_type": "Завтрак",
  "customer": "Иван",
  "date": "...",
  "time": "...",
  "kitchen_notes": "...",
  "delivery_address": "...",
  "mode": "full | split",
  "items": [
    { "name": "Салат", "qty": 2, "category": "Салаты", "portion": 150 }
  ]
}
```

### mode

| mode | תיאור |
|------|--------|
| `full` | קבלה אחת — כל ההזמנה |
| `split` | קבלה נפרדת לכל קטגוריה (מאפיה / סלטים / שתיה וכו') |

## ESC/POS — פרטי Encoding

### CP866 (רוסית)
```
А-Я → 0x80-0x9F
а-п → 0xA0-0xAF
р-я → 0xE0-0xEF
Ё   → 0xF0
ё   → 0xF1
№   → 0xFC
—   → 0x2D
```

### CP862 (עברית)
```
א-ת → 0x80-0x9A
```
עברית מודפסת מימין-לשמאל ידנית: `reverseHebPart(s)` הופך את החלק אחרי `: `.

## שגיאות שנתקלנו בהן

| שגיאה | סיבה | פתרון |
|--------|-------|--------|
| Timeout 2s→15s→30s | PowerShell Add-Type מקמפל C# בכל הדפסה (20-30s) | Pre-compiled kc_print.exe |
| ERR:StartDoc (ראשון) | `DOCINFOW` struct כלל `cbSize` שלא קיים ב-Win32 DOC_INFO_1 | הסרת cbSize |
| ERR:StartDoc (שני) | C# struct marshaling לא אמין | Manual IntPtr layout |
| exe ישן ב-cache | `ensureExe()` בדק `existsSync` ולא דרס | תמיד לדרוס ב-startup |
| רוסית לא מודפסת | ESC t 0x11 לא עובד על AP80 זה | ESC t 0x07 + CP866 |
| עברית LTR | ESC/POS מדפיס תמיד LTR | reverseHebPart() |
| Vercel deploy "no id" | `.vercel/project.json` חסר שדה `id` | הוספת `id` זהה ל-`projectId` |
| עברית → מקפים | חשד: hasHebrew regex לא עובד בקובץ מוטמע | פתוח — לבדיקה |

## מה נדרש על מחשב השף

- Windows 7+ (32-bit or 64-bit)
- Node.js v12.22.12 (מ-nodejs.org/dist/v12.22.12/)
- מדפסת AP80 מחוברת USB, שם `Kassa` ב-Windows
- `start.bat` — מריצים פעם אחת בבוקר, משאירים פתוח

## לשבוע הבא — מדפסת מדבקות

בעת רכישת מדפסת מדבקות חדשה:
- לבדוק ESC/POS compatibility (רוב המדפסות התרמיות תומכות)
- לבדוק code pages נתמכות (ESC t combinations)
- להריץ `/test` route על המדפסת החדשה כדי לאתר ESC t+encoding שעובד
- שם המדפסת ב-Windows — לעדכן `PRINTER_NAME` ב-`start.bat` או env var
- ה-kc_print.exe עובד עם כל מדפסת Windows — רק שם המדפסת משתנה
