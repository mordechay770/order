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
- `fldXNADlCSPdnowbQ` — מחיר מכירה (₸)
- `fldNJXzWYU1yTabdc` — עלות (linked)

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

## בעיות ידועות לתיקון (שיחה הבאה)
1. **ניווט** — חזרה ממסך 2 למסך 1, מעבר בין סוגי הזמנות, רענון דף
2. **סצנריה 6279260** — לבדוק שה-BasicFeeder מפרק נכון את `fldTkRa6caF2yl7YG`
3. **שדה Цена** — בסצנריה הסטטית 4907093 משתמש ב-`Цена[]` (linked) אבל החדשה משתמשת ב-`fldXNADlCSPdnowbQ` — לאחד
4. **admin.html** — לוודא שלאחר שמירה ה-localStorage מתעדכן עם webhooks

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
