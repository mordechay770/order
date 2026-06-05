# מערכת ניהול מטבח — דיאגרמת מערכת

## חלק 1: מבנה Airtable — ליבת המטבח

```mermaid
erDiagram
    PRODUCTS["סוגי מוצרים\ntbl93MwGmZ8yLoqHV"] {
        string שם_ברוסית
        string שם_בעברית
        select יחידת_מידה
        formula מחיר_אחרון
        formula יתרה_במלאי
    }

    RECIPES["מתכונים עם מחירים\ntbl053nytobUU4ytc"] {
        number מס_סידורי
        string שם_ברוסית
        select קטגוריה
        text הוראות_הכנה
        rollup סך_נטו_גרמים
        formula משקל_אחרי_בישול
    }

    BOM["כמויות — מתכונים\ntblpmPSqC7TuzElHI"] {
        number ברוטו
        number נטו_לפני_בישול
        percent אחוז_ניקוי
        percent אחוז_בישול
        number נטו_אחרי_בישול
        formula מחיר_לרכיב
    }

    DISHES["סוגי מאכלים עם מחירים\ntblhkNaiSGBiLRUxA"] {
        string שם_ברוסית
        string שם_בעברית
        number משקל_מנה
        formula יחס_מנה
        formula עלות_חומרים
    }

    ASSEMBLY["הרכבות מאכלים\ntblCg9hg1F8oj1mQ7"] {
        number כמות_מהמתכון
        formula יחס_מנה
        formula עלות_חומרים
    }

    PRICES["טבלת מחירי מאכלים\ntblMe5ZQp6Ygfca5W"] {
        number מחיר_תג
        number עלות_חומרים
        formula אחוז_רווח
        select סטטוס_מחיר
    }

    RECIPES ||--o{ BOM : "has ingredients"
    PRODUCTS ||--o{ BOM : "used in"
    DISHES ||--o{ RECIPES : "linked to"
    DISHES ||--o{ ASSEMBLY : "composed of"
    ASSEMBLY }o--|| RECIPES : "uses recipe"
    DISHES ||--o{ PRICES : "price history"
```

---

## חלק 2: זרימת הזמנות (POS)

```mermaid
flowchart TD
    CUSTOMER["👤 לקוח / Customer"]
    ADMIN["👩‍💼 אדמין"]
    ORDERS["🛒 הזמנות אוכל מהמטבח\ntblMnlLwYCD27ou80"]
    ORDERLINES["📋 כמויות — הזמנות\ntblcP1zvc3Tu9oQuL"]
    DISHES["🍽 סוגי מאכלים\ntblhkNaiSGBiLRUxA"]
    KITCHEN["👨‍🍳 מטבח\nСтатус приготовления"]
    DELIVERY["🚗 משלוח\nСтатус доставки"]
    PAYMENT["💳 תשלומים\ntblaNK6mYqr20YtT1"]
    FEEDBACK["⭐ משוב לקוחות\ntblhdaf6K6EeEN906"]

    CUSTOMER -->|"טופס הזמנה"| ORDERS
    ADMIN -->|"Airtable Interface"| ORDERS
    ORDERS ||--o{ ORDERLINES : "contains"
    ORDERLINES -->|"מחיר × כמות"| ORDERS
    DISHES -->|"תפריט + מחיר"| ORDERLINES
    ORDERS -->|"הזמנה לביצוע"| KITCHEN
    KITCHEN -->|"מוכן"| DELIVERY
    DELIVERY -->|"נמסר"| PAYMENT
    PAYMENT -->|"שולם"| FEEDBACK
```

---

## חלק 3: זרימת רכש ומלאי

```mermaid
flowchart LR
    NEED["📊 צורך במוצר\nמינימום מלאי"]
    PO["📄 הזמנת רכש\ntblaBFINci2eLXIQ4"]
    POLINES["כמויות — רכש\ntblD7PBPETbAxPmGV"]
    RECEIPT["📦 קבלת סחורה\ntblUgfmoDoO7Yjt8f"]
    DISPATCH["📤 הוצאת סחורה\ntbla2PkOTI3RbYQ5G"]
    INVENTORY["🏪 מלאי\nyתרה = נכנס - יצא"]
    PRODUCTS["סוגי מוצרים\ntbl93MwGmZ8yLoqHV"]

    NEED --> PO
    PO --> POLINES
    POLINES --> RECEIPT
    RECEIPT -->|"מחיר עדכני"| PRODUCTS
    RECEIPT -->|"כמות נכנסה"| INVENTORY
    DISPATCH -->|"כמות יצאה"| INVENTORY
    INVENTORY --> PRODUCTS
```

---

## חלק 4: זרימת PDF — טכ-קארטות

```mermaid
flowchart TD
    AIRTABLE["🗄 Airtable\nappM61hkcOruhdBuv"]
    DISH["סוגי מאכלים\nTABLE 16"]
    RECIPE["מתכונים עם מחירים\nTABLE 14"]
    BOM["כמויות — מתכונים\nTABLE 15"]

    MAKE["⚙️ Make.com"]
    VARS["Set Variables\nScalar fields"]
    ITER["Iterator\nIngredient rows"]
    AGG["Text Aggregator\n<tr> HTML rows"]

    PDFCO["📄 PDF.co\nHTML → PDF"]
    APITEMPLATE["📄 APITemplate.io\nJinja2 → PDF"]

    TEMPLATES["📁 pdf-templates/"]
    BOM_RU["ingredient-bom-ru.html\nMustache"]
    RECIPE_RU["recipe-card-ru.html\nMustache"]
    MULTI_RU["ingredient-bom-multi-ru.html\nMulti-recipe"]
    APITMPL["*-apitmpl.html\nMake.com bundle"]

    URL["🔗 PDF URL\n→ שמור ב-Airtable"]

    AIRTABLE --> DISH --> MAKE
    AIRTABLE --> RECIPE --> MAKE
    AIRTABLE --> BOM --> MAKE
    MAKE --> VARS
    MAKE --> ITER --> AGG
    VARS --> PDFCO
    AGG --> PDFCO
    TEMPLATES --> BOM_RU --> PDFCO
    TEMPLATES --> RECIPE_RU --> PDFCO
    TEMPLATES --> MULTI_RU --> PDFCO
    TEMPLATES --> APITMPL --> APITEMPLATE
    PDFCO --> URL
    APITEMPLATE --> URL
```

---

## חלק 5: ארכיטקטורת הסקיל kitchen-ops

```mermaid
flowchart TD
    USER["👤 משתמש\nב-VS Code"]
    SKILL["⚡ /kitchen-ops\nSKILL.md"]
    CLAUDE["🤖 Claude\nSonnet 4.6"]

    REF1["📖 airtable-schema.md\n38 tables + field IDs"]
    REF2["📖 templates.md\n10 templates + placeholders"]
    REF3["📖 make-workflow.md\nScenarios + module sequence"]

    ENV[".env\nAIRTABLE_TOKEN\nBASE_ID"]

    ACTION1["✏️ עריכת תבניות HTML"]
    ACTION2["📝 כתיבת SOP/צ'ק-ליסט"]
    ACTION3["💰 חישוב פוד-קוסט"]
    ACTION4["🔍 ГОСТ Validation"]
    ACTION5["📊 שאילתות Airtable API"]
    ACTION6["📄 הפקת PDF"]

    USER -->|"/kitchen-ops"| SKILL
    SKILL --> CLAUDE
    SKILL --> REF1
    SKILL --> REF2
    SKILL --> REF3
    ENV -->|"credentials"| CLAUDE

    CLAUDE --> ACTION1
    CLAUDE --> ACTION2
    CLAUDE --> ACTION3
    CLAUDE --> ACTION4
    CLAUDE -->|"curl API calls"| ACTION5
    CLAUDE -->|"via Make.com / PDF.co"| ACTION6
```

---

---

## חלק 6: מערכת הזמנות אירועים

### 6א — טבלאות Airtable חדשות (ליצור ידנית)

#### טבלה: אולמות / Halls
| שדה | סוג | תיאור |
|-----|-----|--------|
| `שם האולם` | Text | שם תצוגה |
| `קיבולת` | Number | מספר מקסימלי של אורחים |
| `מחיר לשעה` | Currency | ₪ לשעה |
| `תיאור` | Long text | תיאור האולם |
| `תמונה` | Attachment | תמונות האולם |
| `פעיל` | Checkbox | מוצג ללקוחות |

#### טבלה: שירותי אירועים / Event Services
| שדה | סוג | תיאור |
|-----|-----|--------|
| `שם השירות` | Text | ברוסית |
| `קטגוריה` | Single select | פרסונל / כלים / ציוד / עיצוב |
| `מחיר` | Currency | ₪ ליחידה |
| `יחידה` | Text | יח', שעה, קומפלקט |
| `כמות ברירת מחדל` | Number | מוצע ללקוח |
| `סוג אירוע` | Multi select | pominki / birthday / wedding / הכל |
| `פעיל` | Checkbox | |

#### טבלה: הזמנות אירועים / Event Orders
| שדה | סוג | תיאור |
|-----|-----|--------|
| `מזהה הזמנה` | Auto number | |
| `סוג אירוע` | Single select | pominki / birthday / barmitzva / etc |
| `תאריך` | Date | |
| `שעת התחלה` | Text | HH:MM |
| `שעת סיום` | Text | HH:MM |
| `משך (שעות)` | Number | |
| `מספר אורחים` | Number | |
| `אולם` | Link to Halls | |
| `עלות אולם` | Currency | |
| `מנות` | Long text | JSON: [{id,name,qty,price}] |
| `עלות מנות` | Currency | |
| `שירותים` | Long text | JSON: [{id,name,qty,price}] |
| `עלות שירותים` | Currency | |
| `סה"כ משוער` | Currency | |
| `שם לקוח` | Text | |
| `טלפון` | Phone | |
| `אימייל` | Email | |
| `הערות` | Long text | |
| `סטטוס` | Single select | חדש / בטיפול / אושר / בוטל |
| `נשלח ב` | Date/Time | |

#### עדכון בטבלה: סוגי מאכלים עם מחירים (`tblhkNaiSGBiLRUxA`)
הוסף שדה multi-select:
- `סוג אירוע` — ערכים: pominki, birthday, barmitzva, batmitzva, torah, wedding, all

---

### 6ב — סצנריות Make.com חדשות

#### סצנריה 8a — GET אולמות (בדיקת זמינות)
```
Webhook: GET ?date=YYYY-MM-DD&start=HH:MM&end=HH:MM&guests=N

→ Airtable Search: טבלת אולמות
   Filter: {פעיל} = TRUE()
→ לכל אולם: חפש הזמנות קיימות באותו תאריך/שעה
   (שאילתה לטבלת הזמנות אירועים: {תאריך}=date AND {אולם}=hallId AND overlap)
→ הוסף שדה available=true/false
→ Text Aggregator → JSON
→ Respond 200 + JSON
```

#### סצנריה 8b — GET שירותי אירועים
```
Webhook: GET ?event_type=pominki

→ Airtable Search: טבלת שירותי אירועים
   Filter: {פעיל}=TRUE() AND (FIND("event_type",{סוג אירוע}) OR FIND("all",{סוג אירוע}))
→ Text Aggregator → JSON:
  [{id, category, name_ru, price, unit, qty_default}]
→ Respond 200 + JSON
```

#### סצנריה 8c — GET תפריט אירוע
```
Webhook: GET ?event_type=pominki

→ Airtable Search: סוגי מאכלים עם מחירים (tblhkNaiSGBiLRUxA)
   Filter: FIND("event_type",{סוג אירוע}) OR FIND("all",{סוג אירוע})
   Fields: שם המאכל ברוסית, Цена, תמונה, משקל או נפח למנה
→ Text Aggregator → JSON
→ Respond 200 + JSON
```

#### סצנריה 8d — POST הזמנת אירוע
```
Webhook: POST (JSON body)

→ Airtable Create Record: הזמנות אירועים
   Map all fields from payload
→ (Optional) Slack/WhatsApp notification to manager
→ Respond 200 {"status":"ok","id":recordId}
```

---

### 6ג — קישורים ל-WhatsApp (Deep Links)
```
כללי:         event-form.html
פומינקי:      event-form.html?type=pominki
יום הולדת:    event-form.html?type=birthday
בר מצווה:     event-form.html?type=barmitzva
```

---

## סיכום — מה יש לך

| שכבה | כלים | סטטוס |
|------|------|--------|
| **נתונים** | Airtable (38 טבלאות) | ✅ פעיל |
| **אוטומציה** | Make.com | ✅ פעיל |
| **PDF** | PDF.co + APITemplate.io | ✅ פעיל |
| **תבניות** | 12 קבצי HTML | ✅ מוכנים |
| **AI Context** | `/kitchen-ops` skill | ✅ בנוי היום |
| **POS** | הזמנות אוכל מהמטבח | ✅ קיים ב-Airtable |
| **מלאי** | יתרה = נכנס - יצא | ✅ נוסחה קיימת |
| **פוד-קוסט** | מחיר אחרון + rollup | ✅ נוסחאות קיימות |
| **הזמנות אירועים** | event-form.html (7 מסכים) | ✅ מוכן |
| **ניהול אולמות** | Airtable + Make.com 8a–8d | 🔧 להגדיר |
