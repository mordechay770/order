# CHANGELOG — kitchen-orders

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
