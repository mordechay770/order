# Make.com Blueprints — Kitchen Orders
**Mordechai · 2026-04-21**

---

## איך לייבא

1. Make.com → **Scenarios** → **Create a new scenario**
2. לחץ על שלוש נקודות (⋯) → **Import Blueprint**
3. בחר את קובץ ה-JSON המתאים
4. חבר את ה-Connections וה-Webhooks (ראה למטה)
5. הפעל את התרחיש

---

## ה-6 תרחישים

| קובץ | שם | Webhook | תפקיד |
|------|-----|---------|-------|
| `5a-new-order.json` | New Order | `kc-new-order` | מקבל הזמנה, שומר Airtable, WhatsApp ללקוח + אדמין |
| `5b-voucher-check.json` | Voucher Check | `kc-voucher-check` | בודק קוד ושיבר, מחזיר יתרה + בעלים |
| `5c-menu-fetch.json` | Menu Fetch | `kc-menu-fetch` | מושך תפריט זמין מ-Airtable |
| `5d-time-slots.json` | Time Slots | `kc-time-slots` | מושך הגדרות תאריכים וחיתוך הזמנות |
| `5e-hub-settings.json` | Hub Settings | `kc-hub-settings` | הכרזות, שעות, מה מוצג בדף הראשי |
| `5f-order-approval.json` | Order Approval | `kc-order-approval` | אישור/דחייה → עדכון Airtable → PDF → WhatsApp |

---

## Placeholders להחלפה

לאחר ייבוא כל תרחיש, יש לחפש ולהחליף:

| Placeholder | איפה למצוא |
|-------------|-----------|
| `YOUR_AIRTABLE_CONNECTION_ID` | נבחר אוטומטית כשמחברים Airtable |
| `YOUR_AIRTABLE_BASE_ID` | Airtable → Help → API → Base ID (מתחיל ב-`app`) |
| `YOUR_AIRTABLE_PERSONAL_ACCESS_TOKEN` | Airtable → Account → Developer Hub → Personal tokens |
| `YOUR_GREEN_API_INSTANCE_ID` | Green API → My Instances → Instance ID |
| `YOUR_GREEN_API_TOKEN` | Green API → My Instances → API Token |
| `YOUR_ADMIN_PHONE` | מספר ה-WhatsApp של האדמין (ללא +, לדוגמה: `77001234567`) |
| `YOUR_CHEF_PHONE` | מספר ה-WhatsApp של הטבח (ללא +) |
| `YOUR_APITEMPLATE_API_KEY` | APITemplate → API Integration → API Key |
| `YOUR_RECEIPT_TEMPLATE_ID` | APITemplate → Templates → בחר תבנית קבלה → Template ID |
| `YOUR_KITCHEN_SHEET_TEMPLATE_ID` | APITemplate → Templates → בחר תבנית מטבח → Template ID |

---

## Webhooks — סדר יצירה

1. בכל תרחיש: לחץ על מודול ה-Webhook הראשון
2. **Add** → תן שם לפי הטבלה למעלה (לדוגמה: `kc-new-order`)
3. העתק את ה-URL שנוצר
4. הדבק אותו בקוד הצד-לקוח:

```javascript
// order-form.html — לחפש ולהחליף:
const ORDER_WEBHOOK   = "https://hook.eu1.make.com/XXXX";  // 5a
const VOUCHER_WEBHOOK = "https://hook.eu1.make.com/XXXX";  // 5b
const MENU_WEBHOOK    = "https://hook.eu1.make.com/XXXX";  // 5c
const SLOTS_WEBHOOK   = "https://hook.eu1.make.com/XXXX";  // 5d

// order-hub.html — לחפש ולהחליף:
const SETTINGS_WEBHOOK = "https://hook.eu1.make.com/XXXX"; // 5e

// ChatRace callback → תרחיש 5f:
// ה-URL של kc-order-approval → הכנס לתצורת ChatRace כ-Webhook URL
```

---

## מבנה Payload נכנס — תרחיש 5a

```json
{
  "order_id": "ORD-20260421-001",
  "type": "shabbat",
  "date": "2026-04-24",
  "items": [{"id": "1", "name": "Суп", "qty": 2, "price": 1500}],
  "customer_name": "Иван Иванов",
  "customer_phone": "77001234567",
  "total": 15000,
  "payment_method": "cash",
  "voucher_code": "",
  "partial_cash": 0,
  "notes": "Без лука",
  "lang": "ru"
}
```

## מבנה Payload נכנס — תרחיש 5b

```json
{ "voucher_code": "ABC123" }
```

## מבנה Payload נכנס — תרחיש 5f (מ-ChatRace)

```json
{
  "order_id": "ORD-20260421-001",
  "action": "approved",
  "reason": ""
}
```
או:
```json
{
  "order_id": "ORD-20260421-001",
  "action": "rejected",
  "reason": "Нет свободных мест на эту дату"
}
```

---

## הערות

- **Zone**: כל ה-blueprints מוגדרים ל-`eu1.make.com`. אם חשבונך ב-`us1` — שנה בהגדרות.
- **5f (approval)**: ה-PDF נשלח כ-`sendFileByUrl` — APITemplate מחזיר `download_url` בתשובה.
- **5c/5d/5e**: משתמשים ב-HTTP → Airtable REST API ישירות (יעיל יותר מ-native module לשאילתות מרובות רשומות).
- **CORS**: כל תגובות ה-Webhook כוללות `Access-Control-Allow-Origin: *` לאפשר קריאות מהדפדפן.
