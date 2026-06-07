# מערכת הזמנות מטבח — Kitchen Orders

## על הפרויקט
מערכת הזמנות למטבח מקצועי עם ממשק admin ו-order form.
**יעד:** הפצה תחילת/אמצע שבוע 08.06.2026

## שני מסלולי הזמנה
- **מסלול קבוע** — ארוחת צהריים/ערב יומיומית, מוזמנת יום לפני, מחיר קבוע
- **מסלול חופשי** — בחירת מנות ספציפיות, פרמיום, עם מגבלות:
  - `min_qty_per_order` per-dish (הגדרה בטבלת מאכלים Airtable)
  - `max_types_per_order` גלובלי (Data Store ב-Make.com)
- **אישור אדמין חובה** לכל הזמנה → רק אחרי אישור המטבח רואה

## Airtable — טבלאות מרכזיות
| טבלה | ID | תפקיד |
|------|----|--------|
| הזמנות | tblMnlLwYCD27ou80 | POS — כל הזמנה |
| כמויות הזמנה | tblcP1zvc3Tu9oQuL | שורות הזמנה |
| מאכלים/תפריט | tblhkNaiSGBiLRUxA | תפריט + מחירים |
| אנשי קשר | tbl9KpBHdGSzhNf0E | לקוחות פרטניים |
| תשלומים | tblaNK6mYqr20YtT1 | תשלומים |

**שדות קריטיים לפיתוח:**
- `fldcekWvpJwdVVMK6` — סטטוס הזמנה (כולל "Ожидает подтверждения менеджера")
- `fldcWbQXZM8Agv6ir` — כמויות (link)
- **חסר:** `סוג מסלול` + `זמין במסלול חופשי` + `min_qty_per_order` — לבנות לפני פיתוח

## מבנה תיקיות
```
kitchen-orders/
├── src/              ← קוד חי (גרסה קנונית)
│   ├── order-form.html
│   ├── order-hub.html
│   ├── admin.html
│   └── index.html
├── make-blueprints/  ← סצנריות Make.com (5a–5f)
├── docs/             ← תיעוד
│   ├── system-diagram.md
│   └── NEXT_SESSION_PROMPT.md
└── archive/v1/       ← גרסאות קודמות
```

## קבצים עיקריים
- `src/order-form.html` — טופס הזמנה
- `src/admin.html` — ממשק ניהול (כולל טאב 🎉 אולמות+שירותים)
- `src/order-hub.html` — מרכז הזמנות

## 🌐 Deploy
| | |
|---|---|
| **GitHub** | `github.com/mordechay770/order` |
| **Vercel URL** | `https://src-sigma-ecru-25.vercel.app` |
| **Root directory** | `src/` |
| **פקודת deploy** | `cd kitchen-orders/src && vercel --prod` |

> ⚠️ Vercel לא מחובר ל-GitHub אוטומטית — deploy ידני אחרי כל שינוי.
> לחיבור אוטומטי: Vercel dashboard → Settings → Git → Connect `mordechay770/order` → Root: `src`

## ניווט בין דפים
- `src/index.html` → דף ראשי (hub) — מפנה ל: order-form, event-form, recipes
- `src/order-form.html` → קישור "← Главная" חוזר ל-Vercel URL
- `src/order-hub.html` → קישור "← Главная" חוזר ל-Vercel URL
- מתכונים: `recipes-ivory-xi.vercel.app` → קישור "← Кухня" חוזר ל-Vercel URL

## סוכנים רלוונטיים
- ⚙️ **מפתח צד-שרת** — Make.com, webhooks
- 🎨 **מפתח ממשקים** — טפסים, admin UI
- 🍽️ **מומחה מטבח** — ולידציה מקצועית

## ארכיטקטורה
- admin.html שומר הגדרות: `localStorage('kc_admin_settings')`
- event-booking/event-form.html קורא מאותו key
- Make.com: webhooks לכל שלב בהזמנה
- Webhook URLs — אין בקוד! נקראים בלבד מ-localStorage

## כללים קריטיים
- שינוי ב-`kc_admin_settings` schema → חייב לעדכן גם ב-event-booking!
- כל שינוי מבני (תיקיות, URLs, deploy) → עדכן סעיף זה ב-CLAUDE.md
- כל שינוי קוד → עדכן CHANGELOG.md
