# CHANGELOG — kitchen-orders

## 2026-06-26 — ESC/POS Thermal Printer + Portion Weight

### בוצע

#### `print-server/print-server.js` — שדרוג
- **`mode` support:** `mode:'full'` = קבלה אחת כולל הכל | `mode:'split'` = קבלה נפרדת לכל קטגוריה
- עברית: `hasHebrew()` + `reverseHebPart()` + ESC t 0x0F + CP862 encoding

#### `src/chef.html` — שדרוג
- שני כפתורי הדפסה בכל כרטיס: **🖨 Весь заказ** (full) | **🖨 По цехам** (split)
- כרטיס הזמנה מציג משקל: `NNNג×כמות=סה"כג` לצד כל מנה
- `JS_B64` עודכן לגרסת print-server.js הנוכחית

#### `src/api/orders-today.js` — שדרוג
- מחזיר `portion` (fldXNADlCSPdnowbQ = גרמים/מ"ל) לכל item
- נוסף `FD_PORTION` const + שדה ב-dishMap + מיפוי ב-return

#### `docs/thermal-printer-setup.md` — חדש
- תיעוד מלא: חומרה, encoding שעובד, ארכיטקטורה, שגיאות שנפתרו, מדריך עדכון

### פתוח
- עברית מדפיסה `-` — `hasHebrew()` regex ייתכן בעיה בקובץ מוטמע (לבדיקה)
- מדפסת מדבקות חדשה — שבוע הבא

---

## 2026-06-24 — Stripe, donation, mission banner, kaspi receipt

### בוצע

#### `/api/stripe-checkout.js` — חדש
- יוצר Stripe Checkout Session דינמי (לא Payment Link סטטי)
- KZT → USD המרה ב-STRIPE_KZT_RATE env (ברירת מחדל 450)
- תרומה כ-line item שני `💚 Пожертвование кухне / Kitchen Donation`
- מחזיר `{url, session_id}` | metadata: amount_kzt, order_num, order_record_id, donation_usd

#### `/api/session.js` — שדרוג מלא
- אחרי תשלום מאושר (payment_status='paid'): יוצר שורת תשלום ב-tblaNK6mYqr20YtT1
- שערH: open.er-api.com/v6/latest/USD עם 4s timeout + fallback null
- Idempotency: מחפש session_id ב-Notes לפני יצירה (לא מכפיל)
- Donation qty row: יוצר שורת כמויות עם DONATION_DISH_ID (reclQgCl0ATOFhepR)

#### `/api/stripe-webhook.js` — חדש (secondary)
- Stripe webhook checkout.session.completed
- HMAC-SHA256 signature verification
- שניוני ל-session.js (לא נדרש אם משתמשים ב-session.js)

#### `order-form.html` — שינויים
- **Mission banner** — כרטיס ירוק על מסך בחירת סוג הזמנה + מסך תשלום (3 שפות)
- **Stripe button** — gradient סגול, spinner, popup blocker fix (window.open סינכרוני)
- **Donation Stripe** — checkbox + quick buttons ($5/$10/$18/$36) + input + ≈₸ display
- **Donation Cash/Kaspi** — checkbox + quick buttons (500/1000/2000/5000₸) + input
- **Kaspi receipt** — הוראה לשלוח קבלה בהודעה לWA (KASPI_RECEIPT i18n object)
- **Donation dish row** — donation_kzt שלוח ל-order.js → יוצר שורת כמויות

#### `/api/order.js` — donation
- הוסף: אם `donation_kzt > 0` → יוצר שורת כמויות עם DONATION_DISH_ID (fire-and-forget)

#### Airtable — donation dish
- נוצר רשומה `reclQgCl0ATOFhepR` = "💚 Пожертвование / תרומה" בטבלת מאכלים

### ⚠️ ממתין לפעולת משתמש
- `STRIPE_SECRET_KEY` — לא מוגדר ב-Vercel → Stripe לא עובד
- `CHEF_TOKEN` / `BAKER_TOKEN` — לא מוגדרים → chef.html/baker.html לא עובדים

---

## 2026-06-23/24 — manager.html + chef.html + orders-today + production fix

### בוצע

#### תיקון קריטי — שמות מתכונים ב-baker.html / chef.html
- `production.js` — שדה `FP_RECIPE` (multipleRecordLinks) מכיל `{id, name}` per linked record
- הוסר `FP_NAME_LKP` (lookup) מרשימת השדות לחלוטין — לא נדרש
- `recipe_name = (f[FP_RECIPE] || [])[0]?.name || ''` — עובד ב-production

#### `src/chef.html` — שיפורים
- הוסף: מספר מאכלים + סה"כ מנות בכל כרטיס הזמנה (`🍽️ X блюд · Y порций`)
- הוסף: הערות מטבח מודגשות עם רקע כחול בכל הזמנה
- הוסף: כפתור "📦 Передано" להזמנות בסטטוס "Готов" → מעדכן delivery_status
- הזמנות "Готов" מוצגות עכשיו בdashboard השף (כולל ב-ACTIVE_STATUSES)

#### `src/api/orders-today.js` — הרחבות
- טווחי תאריכים חדשים: `month` (חודש נוכחי), `this_week` (שבוע נוכחי), custom (`?start=&end=`)
- שדות חדשים בתגובה: `notes_internal`, `delivery_type`, `delivery_addr`, `delivery_status`, `payment_method`, `price`, `total`
- `ACTIVE_STATUSES` כולל עכשיו `'Готов'`

#### `src/manager.html` — דף מנג'ר חדש (נבנה מאפס)
- Login screen → localStorage `manager_token`
- Tabs: 📋 הזמנות | 🏭 ייצור
- Date filter: Сегодня / Завтра / 7 дней / Эта неделя / Месяц / Период (custom range)
- Status filter bar: כל הסטטוסים
- Stats bar: מספר הזמנות / אורחים / פוזיציות
- לחיצה על הזמנה → modal עם עריכה מלאה: סטטוס, פריטים, הערות ×3, משלוח, תשלומים
- תשלומים: שיטות מ-Airtable, מטבע זר (currency/amount/rate → חישוב ₸), תשלומים קיימים
- ייצור: אותו view כמו baker + יצירת הזמנת ייצור חדשה
- "**+ Заказ**" — modal יצירת הזמנה ידנית: חיפוש איש קשר לפי טלפון + יצירה אוטומטית אם לא נמצא

#### `src/api/manager-action.js` — הרחבות
- CORS עודכן לכלול POST
- PATCH — עריכת שדות הזמנה (notes, delivery, status)
- GET `action=payment_methods` — רשימת שיטות תשלום מ-Airtable
- GET `action=payments` — תשלומים קיימים לפי order_id
- GET `action=contacts` — חיפוש איש קשר לפי טלפון (last 9 digits)
- POST `action=pay` — יצירת תשלום חדש עם תמיכה במטבע זר
- POST `action=create_contact` — יצירת איש קשר חדש אם לא נמצא

### Deploy
- GitHub: mordechay770/order (master) → Vercel src-sigma-ecru-25.vercel.app ✅ 2026-06-24

---

## 2026-06-22 — UI/UX + תמחור לפי סוג הזמנה + תיקוני שדות

### בוצע

#### UI — בחירת תאריך ושעה
- **`order-form.html`** — עיצוב מחדש של date/time picker:
  - כרטיסי תאריך גדולים (72px) עם יום/תאריך/חודש + שעת משלוח קבועה על הכרטיס (לסוגים fixed)
  - 7 תאריכים + כפתור "📆 אחר" (native date picker עד 3 חודשים קדימה)
  - בחירת שעה: 9 כפתורי slots (09:00–17:00) במקום native `<input type="time">`
  - **תיקון timezone:** `parseLocalDate(iso)` — מונע יום שגוי ב-UTC+5 (אלמטי)
  - **i18n:** שמות ימים וחודשים מותאמים לשפה (RU/EN/HE) דרך `lDay()`/`lMon()`
  - תוספת מפתחות תרגום: `date_delivery`, `time_delivery`, `date_other` בכל 3 שפות

#### תיקונים ב-`/api/menu`
- **שדה מחיר שגוי תוקן:** `fldXNADlCSPdnowbQ` הוא "משקל או נפח למנה" (גרמים) — לא מחיר
- **מחיר אמיתי:** עכשיו שולף מ-`tblMe5ZQp6Ygfca5W` (אבלת מחירי מאכלים) לפי dish ID + סוג הזמנה
- **גודל מנה:** `portion` מוחזר כ-field נפרד (גרמים) ומוצג בכרטיס: "⚖ 240 г"
- **תמחור לפי סוג הזמנה:** שדה חדש `סוג הזמנה` (fldxQeaawfV911vMK) נוצר ב-Airtable
  - fallback hierarchy: מחיר ספציפי לסוג → מחיר ברירת מחדל (שורה ללא סוג)

#### תיקונים ב-`/api/order`
- **קישור מנה לרשומה:** `FQ_DISH_LNK = 'fldYKuxwzyR0zsA6W'` — link אמיתי ל-מאכלים
  - אם `dish_id` הוא record ID תקין (`rec...`) → נשמר כקישור; אחרת fallback לטקסט חופשי
- **payment_method whitelist:** רק `מזומן`/`כספי` — ערכים לא מוכרים מחזירים 400
- **הגבלת items:** מקסימום 50 פריטים לבקשה

### שדות Airtable חדשים
| טבלה | שדה | ID | תפקיד |
|---|---|---|---|
| אבלת מחירי מאכלים | סוג הזמנה | fldxQeaawfV911vMK | מחיר per-type |

### קבועים חשובים שהתעדכנו
```js
// menu.js
T_PRICES = 'tblMe5ZQp6Ygfca5W'   // טבלת מחירים
FP_DISH  = 'fldlsT3qYsuBDX2oP'   // link → מאכלים
FP_PRICE = 'fldiDyytpcE9CZlc0'   // Цена, תג.
FP_TYPE  = 'fldxQeaawfV911vMK'   // סוג הזמנה (חדש)
FD_PORTION = 'fldXNADlCSPdnowbQ' // גרמים (לא מחיר!)

// order.js
FQ_DISH_LNK = 'fldYKuxwzyR0zsA6W' // link → מאכלים (חדש)
```

---

## 2026-06-22 — `/api/order` — שמירת הזמנות ישירות ל-Airtable

### בוצע
- **`src/api/order.js`** — Vercel Serverless Function חדשה שמחליפה Make.com scenario 4914420
  - POST קבלת הזמנה → שמירה ב-`הזמנות` (tblMnlLwYCD27ou80) + שורות ב-`כמויות` (tblcP1zvc3Tu9oQuL)
  - כותב: שם לקוח, טלפון, כתובת, הערות, תאריך, מחיר, צורת תשלום, סטטוס (Ожидает)
  - שורות כמות: קישור להזמנה, שם מאכל, כמות, מחיר ליחידה — במקביל (Promise.all)
  - מחזיר: `{success, order_id, order_number}` (autoNumber מ-Airtable)
  - אבטחה: CORS נעול, token server-side בלבד
- **`src/order-form.html`** — עודכן להשתמש ב-`/api/order` כברירת מחדל
  - הוסף `ORDER_API = '/api/order'`
  - `doSubmitOrder` + `doSubmitCombined` — fallback ל-`ORDER_API` כאשר אין URL מוגדר ב-admin
  - הוסרה לוגיקת TEST mode (הוחלפה ב-API אמיתי)
  - Make.com webhook עדיין תומך אם מוגדר ב-admin settings (עדיפות ראשונה)

### החלטות
- Make.com scenario 4914420 עדיין קיים כ-override אם admin מגדיר webhook URL
- Delivery time מנורמל ל-UTC+5 (שעון אלמטי)
- singleSelect values: Ожидает / מזומן / כספי / תלוש / מעורב / כן / לא

---

## 2026-06-22 — מעבר ל-Vercel API Route + אבטחה

### בוצע
- **`src/api/menu.js`** — Vercel Serverless Function חדשה שמחליפה את Make.com webhooks לטעינת תפריטים
  - קריאה ישירה ל-Airtable API (טוקן server-side בלבד, לא נחשף ל-client)
  - type parameter עובר דרך whitelist של 9 ערכים מורשים — כל שאר הבקשות מחזירות 400
  - CORS נעול לדומיין הייצור בלבד
  - CDN Cache 5 דקות (s-maxage=300)
  - לוגיקה: static types (בוקר/טיול/מיוחד/מאפים/מוצרים מוכנים) → query מאכלים; daily types (צהריים/ערב/שבת/חג) → query slots → templates → dishes
  - `returnFieldsByFieldId=true` על כל קריאות Airtable (שדות לפי ID לא שם)
  - תמיכה ב-`min_qty` per-dish מ-Airtable (`fldnDpI70fL8sRXKF`)
- **`src/order-form.html`** — עודכן לקרוא `/api/menu?type=X` במקום Make.com
  - `MENU_API = '/api/menu'` — קבוע אחד במקום webhook URLs בכל ORDER_TYPE
  - `prewarmMenuCache` עודכן להשתמש ב-MENU_API
- **`src/package.json`** — נוסף עם `engines: {node: "20.x"}`
- **`AIRTABLE_TOKEN`** — הוגדר כ-environment variable ב-Vercel

### ביצועים
- זמן תגובה: **761ms** במקום 4-5 שניות עם Make.com

### אבטחה
- API key לא מגיע ל-client בשום מצב
- whitelist חסום injection/enumeration
- CORS חסום cross-origin

### החלטות
- Make.com נשאר **רק** ל-POST הזמנות (4914420) — לא לקריאת תפריטים
- מעבר ל-API נעשה בשלב א'; Supabase migration — לאחר השקה

### ידוע לטיפול
- UI/UX כולו לסקירה: בחירת תאריך, שעות, layout כרטיסי מנות
- POST הזמנה — עדיין דרך Make.com webhook; לשקול Vercel API Route גם שם

---

## 2026-06-09 — הרחבת סקיצות: שפות, סטטוסים והרשאות

### בוצע
- `docs/ops-screen-mockups.html` הורחב עם עברית/רוסית, מעקב סטטוס הזמנה, סטטוס תשלום, הודעות ללקוח והרשאות משתמשים.
- נוספה חלוקת תחנות מטבח: אפייה, סלטים, בישול ושף שרואה הכל.
- `docs/ADMIN_KITCHEN_WORKFLOW_SPEC.md` עודכן עם דרישות שפות, סטטוסים, הרשאות והודעות יזומות ללקוח.
- `docs/NEXT_SESSION_PROMPT.md` עודכן עם דרישות אלו להמשך.

### החלטות
- סטטוס הזמנה וסטטוס תשלום יהיו שדות נפרדים.
- מסכי מטבח יסוננו לפי תחנה ותפקיד.
- אדמיניסטרטור יוכל לשלוח הודעות WhatsApp יזומות ללקוח מתוך ההזמנה.

---

## 2026-06-09 — סקיצת HTML למסכי מנהל, מטבח ומשגיח

### בוצע
- נוסף `docs/ops-screen-mockups.html` כסקיצה ויזואלית עצמאית למסכי מנהל, מטבח ומשגיח.
- `docs/ADMIN_KITCHEN_WORKFLOW_SPEC.md` עודכן עם דרישת `supervisor.html` למשימות השגחה.
- `docs/NEXT_SESSION_PROMPT.md` עודכן עם קישור לסקיצה ועם שלושת המסכים הנדרשים.

### החלטות
- נוסף מסך משגיח ייעודי למשימות כשרות לפי הזמנות ומוצרים עם הערות כשרות.
- המשגיח צריך לראות היום, מחר ושבוע קדימה: בצקים, בדיקת ירק, שחיטה, בשרי/חלבי ומשימות חריגות.

---

## 2026-06-09 — אפיון אישור מנהל ומסך מטבח

### בוצע
- נוסף `docs/ADMIN_KITCHEN_WORKFLOW_SPEC.md` עם אפיון לזרימת אישור מנהל, כפתורי Green API, מסך מנהל ומסך מטבח.
- `docs/NEXT_SESSION_PROMPT.md` עודכן עם קישור לאפיון החדש וסדר עבודה מומלץ.

### החלטות
- אישור מנהל יתבצע דרך WhatsApp buttons ב-Green API, עם webhook תגובה ב-Make.
- ייבנה מסך מנהל נפרד להצגת הזמנות ממתינות, סיכום מוצרים עיקריים ואזהרות מלאי.
- ייבנה מסך מטבח מקצועי עם תצוגה לפי הזמנות, מנות, חומרי גלם ושעות.

---

## 2026-06-09 — Security audit notes for next session

### בוצע
- נוסף `docs/SECURITY_NEXT_STEPS.md` עם ממצאי אבטחה על `admin.html`, webhooks ציבוריים, XSS ו-headers.
- `docs/NEXT_SESSION_PROMPT.md` עודכן כך שהחלטות האבטחה יופיעו בראש השיחה הבאה.

### החלטה ארכיטקטונית
- Webhooks עדיפים על קריאת Airtable API ישירה מהדפדפן, אבל webhook ציבורי אינו סוד ואינו מקור אמון.
- כיוון מומלץ: Browser → Make רק עבור intake ציבורי עם validation וסטטוס pending; Admin חייב הגנה ברמת hosting/server.

---

## 2026-06-09 — התקדמות: ניהול סוגי הזמנות ב-admin

### בוצע
- `src/admin.html` — טאב סוגי הזמנות הורחב לעריכת `date_mode`, deadline, webhook פר מסלול, Airtable record ID ו-template ID.
- ברירות המחדל של סוגי ההזמנות סודרו לקטגוריות `daily/shabbat/custom/preorder`, בהתאמה ל-`order-form.html`.
- `src/order-form.html` — טעינת תפריט ושליחת הזמנה משתמשות ב-webhook של המסלול אם הוגדר, ונופלות חזרה ל-webhook הכללי או לדמו מקומי.
- payload של הזמנה כולל כעת metadata של מסלול: model, category, Airtable record ID ו-template ID.
- תוקן fallback כאשר Make webhook ריק.

### בדיקות
- בדיקת syntax ל-JavaScript המוטמע ב-`admin.html` וב-`order-form.html` עברה בהצלחה.

---

## 2026-06-07 — שיחה 5: פיצ'ר שבת + Vercel deploy

### בוצע
- פיצ'ר שבת: זמני הדלקת נרות + הבדלה לפי מיקום גולש (Hebcal API + ipapi.co)
- מסך סגירה מציג שני כרטיסים: שעת נרות + שעת צאת שבת
- admin.html — הוסבר שהשדה הוא fallback בלבד
- תיקוני איכות: fetch timeout 3s, sessionStorage מפתח קבוע, init fallback 4s
- Vercel חובר ל-GitHub (deploy ידני עד אימות אוטומטי)
- Deploy פעיל: `src-sigma-ecru-25.vercel.app`

### פתוח לשיחה הבאה
- לאמת שVercel מתעדכן אוטומטי מ-push (BACKLOG)
- Make webhooks 5a–5f
- admin.html — טאב ⚙️ סוגי הזמנות

---

## 2026-06-07 — GitHub + Vercel + Landing Page

### בוצע
- חיבור repo ל-GitHub: `mordechay770/order`
- Deploy ל-Vercel: `src-sigma-ecru-25.vercel.app`
- `src/index.html` → דף נחיתה חדש עם 3 כרטיסים (הזמנות / אירועים / מתכונים)
- ניווט "← Главная" ב-order-form + order-hub
- CLAUDE.md עודכן עם URLs, deploy workflow, כללי ניווט

### פתוח לשיחה הבאה
- חיבור Vercel ↔ GitHub (deploy אוטומטי)
- דיוק פיצ'ר שבת (חסימה, UX, שעות)
- Make webhooks 5a–5f
- admin.html — טאב ⚙️ סוגי הזמנות

---

## 2026-06-05 — ארגון תיקיות + אבטחה

### בוצע
- מבנה תיקיות חדש: `src/` | `docs/` | `archive/v1/` | `make-blueprints/`
- הוסר `קלאוד דיזיין/` — קוד עבר ל-`src/`
- Webhook URLs הוסרו מקוד מקור — נקראים בלבד מ-`localStorage(kc_admin_settings)`
- נמחקו קבצים כפולים מהשורש
- חיבור repo ל-GitHub: `mordechay770/order`

---

## 2026-06-05 — DB Airtable — בנייה מלאה (שיחה 2)

### בוצע (MCP Airtable)
- ✅ `סוגי הזמנות` (multipleSelects, 8 ערכים) → מאכלים `tblhkNaiSGBiLRUxA` | `flddm1dEMqIXBfieF`
- ✅ `min_qty_per_order` (number) → מאכלים | `fldnDpI70fL8sRXKF`
- ✅ טבלה `סוגי הזמנות` (`tblJ7a7d5HfORkMu4`) — 9 שדות + link → תבניות
- ✅ `סוג הזמנה` (link → `tblJ7a7d5HfORkMu4`) → הזמנות `tblMnlLwYCD27ou80` | `fld7o9NaEBIFu2cUQ`
- שרשרת מוכנה: מאכלים ← סוגי הזמנות ← הזמנות ← כמויות

### החלטות DBA
- `שעת_הגשה` + `deadline_time` נשארות dateTime (Airtable אין time type)
- `deadline_time` — Make.com משתמש בה לחישוב השוואת שעות
- `תאריך` — רלוונטי רק ל-open routes, frontend יסתיר עבור fixed

---

## 2026-06-05 — 4 קטגוריות + חסימת שבת/חגים + תיקוני מובייל

### מה בוצע
- **4 קטגוריות:** daily / shabbat / custom / preorder (שבת וחגים — שורה נפרדת)
- **תיאורי סקציות:** טקסט הסבר מתחת לכל כותרת, ניתן לעריכה מ-admin (3 שפות)
- **חסימת שבת:** שישי מ-הדלקת נרות + שבת כולה → מסך "Шаббат Шалом"
- **חסימת חגים:** closure_blocks ב-admin — from/to datetime לכל חג (יום טוב)
- **admin → טאב 🕯 Выходные:** שעת הדלקת נרות + ניהול תקופות חסימה
- **סינון תאריכים:** שבת מסוננת מרשימת daily, שישי מסוננת לערב
- **מובייל תיקונים:** input font-size → 16px (מניעת iOS zoom), qty-btn/back-btn → 44px, grid minmax → 90px
- **גלישת טקסט:** type-card title/sub עם line-clamp וword-break
- **i18n שפות:** שינוי שפה מרנדר מחדש גם את כותרות הסקציות

---

## 2026-06-05 — 3 קטגוריות + semifinished + שיפורי UX

### מה בוצע
- ORDER_TYPES: 9 סוגים + שדה `category` (meal/custom/preorder)
- סוג חדש: `semifinished` 🥟 "Полуфабрикаты" — category preorder
- מאפים עבר ל-category preorder (לא custom)
- `renderTypeCards()`: 3 סקציות (meal / custom / preorder)
- CSS חדש: כותרת סקציה עם קו gold, mobile horizontal scroll ל-meal row
- Preorder cards: רקע `#FDFAF2` + icon-wrap gold-soft
- selected state: border gold + glow
- admin.html: 9 סוגים + dropdown category + TEXT_KEYS לכותרות סקציות
- i18n: מפתח `preorder_menu_label` בשלוש שפות

---

## 2026-06-05 — UI מסלולים חדשים + תאימות admin

### מה בוצע
- `order-form.html`: ORDER_TYPES מוחלף ל-8 מסלולים (fixed/open model)
- UI מסך 1: שתי שורות עם תווית סקציה (CSS: `.type-section`, `.type-section-label`, `.type-row`)
- `selectType()`: fixed → date picker | open → ישירות למנות
- `changeQty()`: min_qty enforcement במסלול open
- i18n: הוספת מפתחות `fixed_menu_label` / `open_menu_label` לשלוש שפות
- טעינה מ-localStorage: order_types + texts מוחלים בהפעלה (לא רק מ-webhook)
- `admin.html`: DEFAULT_SETTINGS מעודכן ל-8 מסלולים חדשים
- `admin.html`: עורך order_types — הוספת select "Модель заказа" (fixed/open), הסרת "На всю ширину"
- `collectOrderTypes()`: כולל שדה `model`

### פתוח לשיחה הבאה
- בניית טבלת `סוגי הזמנות` ב-Airtable
- הוספת שדות חדשים לטבלת מאכלים (min_qty_per_order וכו')
- מסך 2 fixed: UI הצגת מנות בלבד (qty starting from 1, no toggle)
- אפיון deadline UI (מה מוצג ללקוח אחרי deadline)
- אפיון תהליך אישור מנג'ר

---

## 2026-06-05 — אפיון מלא מסלולים + ארכיטקטורה DB

### החלטות
- גרסה קנונית: `קלאוד דיזיין/` (לא שורש)
- 8 מסלולים: בוקר(09:30) | צהריים(11:00) | ערב(17:00) | שבת | חג | טיול | מיוחד | מאפים
- מודל fixed (5 ראשונים) vs open (3 אחרונים) — ממשק שונה לכל מודל
- ארכיטקטורה: מאכלים ← תבניות ← סוגי הזמנות (חדש) ← הזמנות
- שדה `סוגי הזמנות` (multiSelect) על טבלת מאכלים — פילטר כשירות
- Deadline: שני שדות — `deadline_days_before` (number) + `deadline_time` (time)
- כל הגדרות תפעוליות דינמיות דרך admin.html
- Supabase — פרויקט נפרד אחרי השקה
- לקוחות — כולם בשלב א'

### פתוח לשיחה הבאה
- בניית טבלת `סוגי הזמנות` ב-Airtable
- הוספת שדות חדשים לטבלת מאכלים
- עדכון order-form.html למבנה החדש
- אפיון תהליך אישור מנג'ר

---

## 2026-06-04 — סריקת צוות + אפיון ראשוני

### ממצאי הצוות

#### 👑 מנהל טכני
- התשתית קיימת ומוכנה: 3 ממשקים + 6 blueprints
- הבלוק העיקרי: webhooks לא מחוברים (placeholders עדיין XXXX)
- שני מסלולים הוגדרו: קבוע + חופשי
- הערכה: יום עבודה אחד ל-MVP אם כל credentials בידיים

#### ⚙️ מפתח צד-שרת
- 6 blueprints מוכנים לייבוא (`5a–5f`) עם payload מוגדר
- webhooks צריכים: Airtable connection + Green API + APItemplate
- זרימת אישור אדמין: תרחיש 5f (Order Approval)
- ⚠️ לברר: איזו zone — eu1 או us1?

#### 🎨 מפתח ממשקים
- עיצוב איכותי: navy+gold, Fraunces+Roboto, רספונסיבי
- ⚠️ שאלה פתוחה: שורש (`order-form.html`) vs `קלאוד דיזיין/` — מה קנוני?

#### 🗄️ DBA
- אישור אדמין קיים ב-Airtable: `fldcekWvpJwdVVMK6` עם choice "Ожидает подтверждения менеджера"
- **3 שדות חסרים:** `סוג מסלול`, `זמין במסלול חופשי`, `min_qty_per_order`
- `max_types_per_order` → Data Store ב-Make (לא שדה Airtable)
- כפילות סטטוס לנקות: "ממתין לאישור" + רוסית כפולים
- שתי טבלות לקוח: מחלקות (12) + פרטניים (26) — לברר מה להשתמש

#### 🧪 בודק איכות — פתוח לפני הפצה
- [ ] ייבוא blueprints + webhooks חיים
- [ ] חיבור Airtable (base ID + token)
- [ ] חיבור Green API
- [ ] APItemplate — יש template ID?
- [ ] בדיקת end-to-end הזמנה ניסיון
- [ ] מענה על שאלות פתוחות (ראה CLAUDE.md)

### פתוח לשיחה הבאה
- אפיון מלא עם שאלות תהליך קיים
- הוספת 3 שדות Airtable
- ייבוא blueprints ל-Make.com
