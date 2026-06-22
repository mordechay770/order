# מערכת הזמנות מטבח — Kitchen Orders

## על הפרויקט
מערכת הזמנות למטבח מקצועי עם ממשק admin ו-order form.

## ארכיטקטורת תפריטים — שתי סצנריות Make.com

### סצנריה 4907093 — תפריט סטטי (GET → רשימה שטוחה)
- **Webhook:** `https://hook.eu1.make.com/9nn5o1g799illwe59ddkjuycp7mx3p9l`
- **סוגי הזמנות:** בוקר, טיול, מיוחד, מאפים, מוצרים מוכנים
- **קריאה:** `GET ?type=בוקר`
- **תשובה:** `[{id, name, price, portion, photo_url, category}]`
- **זרימה:** Webhook → Search מאכלים (לפי שדה `סוגי הזמנות`) → TextAggregator → Respond

### סצנריה 6279260 — תפריט יומי (GET → מקובץ לפי תאריך)
- **Webhook:** `https://hook.eu1.make.com/xvyoj33anotp4izeokbg26cl2j52cj2x`
- **סוגי הזמנות:** צהריים, ערב, שבת, חג
- **קריאה:** `GET ?type=צהריים`
- **תשובה:** `[{date, template, dishes:[{id, name, price, portion}]}]`
- **זרימה:** Webhook → Search סוגי הזמנות (סטטוס=פתוח+תאריך עתידי) → Get תבנית → BasicFeeder מנות → Get מאכל → TextAggregator per date → TextAggregator all → Respond

### סצנריה 4914420 — קבלת הזמנה (POST → שמירה ב-Airtable)
- **Webhook:** (webhook ID 2684828)
- **תפקיד:** מקבל JSON הזמנה → יוצר רשומה בהזמנות + שורות בכמויות הזמנה

## Airtable — טבלאות ושדות

### טבלאות מרכזיות
| טבלה | ID | תפקיד |
|------|----|--------|
| הזמנות | tblMnlLwYCD27ou80 | POS |
| כמויות הזמנה | tblcP1zvc3Tu9oQuL | שורות הזמנה |
| מאכלים | tblhkNaiSGBiLRUxA | תפריט + מחירים |
| תבניות | tbl0T5TTLqDr0uCGR | תבניות תפריט יומי |
| סוגי הזמנות | tblJ7a7d5HfORkMu4 | לוח תאריכים יומי |
| אנשי קשר | tbl9KpBHdGSzhNf0E | לקוחות |
| תשלומים | tblaNK6mYqr20YtT1 | תשלומים |

### שדות קריטיים — סוגי הזמנות (tblJ7a7d5HfORkMu4)
- `fldYgc5Vz5ZrFGHop` — סטטוס (טיוטה / פתוח להזמנה / נסגר)
- `flddj8yoiko7U4MWf` — סוג (צהריים/ערב/שבת/חג/בוקר/טיול/מיוחד/מאפים)
- `fldS3NWmxIaqyUm6g` — תאריך
- `fldmCacFFUVxp8CTz` — תבנית (link → תבניות)

### שדות קריטיים — תבניות (tbl0T5TTLqDr0uCGR)
- `fld0oUt0J8IiPpxY8` — שם התבנית
- `fldTkRa6caF2yl7YG` — מנות (link → מאכלים) ← שדה חדש שנוסף
- `fldD1XfdS3z9IeHqw` — סטטוס (Done = פעיל)

### שדות קריטיים — מאכלים (tblhkNaiSGBiLRUxA)
- `fld8ia1Q9b1WoZhE7` — שם המאכל ברוסית
- `fldXNADlCSPdnowbQ` — **משקל או נפח למנה** (גרמים/מ"ל) ← לא מחיר! ← `portion`
- `fldNJXzWYU1yTabdc` — Цена (multipleLookupValues — לא בשימוש ישיר, ראה T_PRICES)
- `fldnDpI70fL8sRXKF` — min_qty_per_order
- `flddm1dEMqIXBfieF` — סוגי הזמנות (multipleSelects)
- `fldosw1NlPlqWbcWI` — link → אבלת מחירי מאכלים

### אבלת מחירי מאכלים (tblMe5ZQp6Ygfca5W)
- `fldlsT3qYsuBDX2oP` — link → מאכלים
- `fldiDyytpcE9CZlc0` — Цена, תג. (המחיר האמיתי)
- `fldxQeaawfV911vMK` — סוג הזמנה (singleSelect) — **חדש 2026-06-22** — ריק = ברירת מחדל
- `fldlZrO5MbI7AelWC` — סטטוס מחיר (Активен/...)
- **לוגיקת fallback:** מחיר per-type → ברירת מחדל (שורה ללא סוג הזמנה)

### שדות קריטיים — כמויות (tblcP1zvc3Tu9oQuL)
- `fld4DlEIkuKYTJIwr` — link → הזמנות
- `fldYKuxwzyR0zsA6W` — link → מאכלים (**עדיף** — קישור אמיתי)
- `fldermtin9p2JInVx` — מאכל (טקסט חופשי) — fallback בלבד
- `fldZI30djxv54dm8j` — כמות
- `fld2hjBAMbg4NeRef` — עלות מנה בזמן ההזמנה

## order-form.html — לוגיקת תפריטים

```
loadDishes(typeId) →
  menuUrl = currentType.menu_webhook  ← per-type מ-admin settings
  GET menuUrl?type=typeId →
    if data[0].date exists:
      menuByDate = data           ← תאריכי תפריט
      renderDatePicker()          ← מציג כרטיסי תאריך
      לחיצה על תאריך → selectMenuDate() → dishes = entry.dishes
    else:
      dishes = data               ← רשימה שטוחה (סטטי)
```

**IDs עבריים ב-admin** (בוקר/צהריים/ערב/שבת) — לא אנגליים (breakfast/lunch).
**Fallback:** אם localStorage ישן ו-menu_webhook ריק → order-form ממלא אוטומטית לפי סוג.

## 🌐 Deploy
| | |
|---|---|
| **GitHub** | `github.com/mordechay770/order` (branch: master) |
| **Vercel URL** | `https://src-sigma-ecru-25.vercel.app` |
| **פקודת deploy** | `cd kitchen-orders && vercel --prod` (אחרי שה-.vercel/project.json מוגדר ל-"src") |
| **⚠️ חשוב** | `kitchen-orders/.vercel/project.json` חייב להכיל projectId של "src" (prj_AAJ63fl2wyX7VttMctNQ12HNI3a3) |

## ארכיטקטורת API — עודכן 2026-06-22

### `/api/menu` — Vercel Serverless (פעיל)
- **קובץ:** `src/api/menu.js`
- **קריאה:** `GET /api/menu?type=צהריים`
- **אבטחה:** whitelist | CORS | token server-side בלבד
- **לוגיקה:**
  - Static types (בוקר/טיול/מיוחד/מאפים/מוצרים מוכנים) → query `מאכלים` by `flddm1dEMqIXBfieF`
  - Daily types (צהריים/ערב/שבת/חג) → query `סוגי הזמנות` (פתוח+עתידי) → `תבניות` → `מאכלים`
- **שדות קריטיים ב-מאכלים:** `fld8ia1Q9b1WoZhE7` (שם רוסית), `fldXNADlCSPdnowbQ` (גרמים ← לא מחיר!), `fldnDpI70fL8sRXKF` (min_qty), `flddm1dEMqIXBfieF` (סוגי הזמנות)
- **מחיר:** נשלף מ-`tblMe5ZQp6Ygfca5W` דרך `fetchPrices(dishIds, orderType, token)`
- **חובה:** `returnFieldsByFieldId=true` על כל קריאת Airtable

### `/api/order` — Vercel Serverless (פעיל מ-2026-06-22)
- **קובץ:** `src/api/order.js`
- **קריאה:** `POST /api/order` עם JSON body
- **שדות חובה:** `customer_name`, `customer_phone`, `items[]`
- **שדות אופציונלים:** `delivery_address`, `notes`, `order_type_title`, `order_date`, `delivery_time`, `payment_method`, `total_price`
- **לוגיקה:** יוצר רשומה ב-`הזמנות` + שורות ב-`כמויות` (parallel)
- **מחזיר:** `{success, order_id, order_number}` (order_number = autoNumber מ-Airtable)
- **סטטוס ברירת מחדל:** `Ожидает`
- **Timezone:** delivery time מנורמל ל-UTC+5 (אלמטי)
- Make.com scenario 4914420 עדיין תומך כ-override דרך admin settings

## משימות פתוחות לשיחה הבאה

### P0 — לפני השקה
- **שפות** — לבדוק שכל ה-i18n עובד: RU/EN/HE — תאריכים, כפתורים, שגיאות, summary
- **בדיקת flow end-to-end** — בחירת תפריט → תאריך → שעה → פרטים → שליחה → Airtable
- **double-submit** — מניעת לחיצה כפולה על כפתור שליחה
- **min_qty validation** — לפני submit Combined/open

### P1 — אבטחה (מצאג CTO + Security)
- Rate limiting על `/api/order` (vercel.json או middleware)
- Idempotency key
- `vercel.json` security headers (X-Frame-Options, CSP)
- `admin.html` — הגנה בסיסית

### P2 — WhatsApp notifications
- Fire-and-forget webhook ל-Make.com scenario 5a אחרי הזמנה
- הודעה ללקוח + למנהל
- `/api/manager-action` — אישור/דחייה
- `manager.html`

### P3 — UX improvements
- Vertical list option לבחירת מנות
- Summary bar קבוע בתחתית
- Deadlines שעברו — greyed out + הסבר
- Save-as-draft

## מבנה תיקיות
```
kitchen-orders/
├── src/              ← קוד חי
│   ├── order-form.html
│   ├── admin.html
│   ├── order-hub.html
│   └── index.html
├── make-blueprints/  ← daily-menu-webhook.json (לייבוא ידני)
├── docs/
└── .vercel/          ← חייב לצדד ל-project "src"
```

## כללים קריטיים
- Deploy: `cd kitchen-orders && vercel --prod` (לא מ-src/)
- שינוי schema ב-`kc_admin_settings` → לעדכן גם ב-event-booking!
- Airtable base: `appM61hkcOruhdBuv`
- Make.com teamId: `7464` | Airtable connection: `3389085`
