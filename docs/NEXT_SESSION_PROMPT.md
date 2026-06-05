# פרומפט פתיחה — kitchen-orders (שיחה הבאה)

## קונטקסט קצר
מערכת הזמנות מטבח. DB ב-Airtable **מוכן לחלוטין** (הושלם 2026-06-05).
גרסה קנונית: `kitchen-orders/קלאוד דיזיין/`
יעד השקה: תחילת/אמצע שבוע 08.06.2026

## שרשרת DB (מוכנה):
```
מאכלים (tblhkNaiSGBiLRUxA)
  └─ סוגי הזמנות [multiSelect] (flddm1dEMqIXBfieF) — 8 ערכים
  └─ min_qty_per_order [number] (fldnDpI70fL8sRXKF)

סוגי הזמנות (tblJ7a7d5HfORkMu4) — 9 שדות: שם, סוג_בסיס, מודל(fixed/open),
  תאריך, שעת_הגשה(dateTime), deadline_days_before, deadline_time(dateTime), תבנית→תבניות, פעיל

הזמנות אוכל מהמטבח (tblMnlLwYCD27ou80)
  └─ סוג הזמנה [link → סוגי הזמנות] (fld7o9NaEBIFu2cUQ)
  └─ כמויות [link → tblcP1zvc3Tu9oQuL] (fldcWbQXZM8Agv6ir)

כמויות - משויך להזמנות (tblcP1zvc3Tu9oQuL)
  └─ הזמנות אוכל מהמטבח [link] (fld4DlEIkuKYTJIwr)
  └─ מתכונים עם מחירים [link] (flddNUut8em9ISFtv)
```

---

## מה צריך להחליט — שאלות פתוחות

### 1. Make.com Webhooks (⚙️ Backend)
- האם webhooks 5a–5f כבר מיובאים ל-Make? אם לא — לייבא blueprints
- מה ה-zone (eu1 / us1)?
- האם יש URL חי לבדיקה?
- Data Store: `max_types_per_order` — האם נוצר?
- Green API — האם מחובר? מה ה-instance + token?

### 2. אבטחה ב-UI (🔒 Security)
- האם ניתן לעקוף אישור מנג'ר? (webhook ישיר ל-Make מהדפדפן)
- ולידציה בצד שרת — Make.com מאמת origin?
- webhook URL חשוף ב-JS — האם בעיה?
- admin.html — יש הגנת סיסמה?

### 3. UI (🎨 Frontend) — שיחה מקבילה מטפלת
- מסך 1: פיצול fixed (שורה עליונה) / open (שורה תחתונה)
- מסך 3: fixed = כמות בלבד | open = בחירת מנות + min_qty
- deadline שעבר — מה מוצג ללקוח?
- admin.html טאב חדש ⚙️ סוגי הזמנות

### 4. תהליך אישור (לאפיין)
- מנגנון אישור מנג'ר: Fillout / webhook+סיסמה / עמוד ייעודי?
- סטטוסים ב-Airtable: "ממתין לאישור" → "מאושר" → "נדחה"
- WhatsApp ללקוח ב-2 שלבים: נקלטה + אושרה

---

## פרומפט כללי לתחילת כל שיחה בפרויקט

```
!resume
kitchen-orders — מערכת הזמנות מטבח.

**מצב נוכחי (2026-06-05):**
- DB מוכן לחלוטין ב-Airtable (base: appM61hkcOruhdBuv)
- גרסה קנונית: kitchen-orders/קלאוד דיזיין/
- UI מסלולים + admin — בפיתוח מקביל
- יעד השקה: 08.06.2026

**טבלאות מרכזיות:**
- הזמנות: tblMnlLwYCD27ou80 | כמויות: tblcP1zvc3Tu9oQuL
- מאכלים: tblhkNaiSGBiLRUxA | סוגי הזמנות: tblJ7a7d5HfORkMu4

**היום נעסוק ב:** [פרט כאן]
```

---

## Skills זמינים לשיחה זו

| Skill | פקודה | מתי להפעיל |
|-------|-------|------------|
| מומחה מתכונים | `/recipe-ops` | בדיקת מאכל, הזנת מתכון, הצעת מחיר, HTML техкарта |
| מומחה מטבח | `/kitchen` | BOM, food cost, SOPs, תבניות PDF |
| מפתח צד-שרת | `/backend` | Make webhooks, Airtable API, JSON |
| מפתח ממשקים | `/frontend` | order-form, admin.html, UI |

---

## סדר עדיפויות להשקה

1. **Make webhooks** — ייבוא blueprints + URLs חיים (בלי זה כלום לא עובד)
2. **בדיקת אבטחה** — webhook URL חשוף? אישור מנג'ר ניתן לעקיפה?
3. **admin.html** — טאב סוגי הזמנות + הגדרת deadlines
4. **בדיקת end-to-end** — הזמנה ניסיון מ-order-form → Airtable → WhatsApp
5. **פריסה** — push לאחסון סטטי
