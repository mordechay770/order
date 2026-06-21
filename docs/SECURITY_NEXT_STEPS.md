# Security Next Steps — kitchen-orders

Updated: 2026-06-09

## Executive Summary

The current `admin.html` is a static client-side admin panel. It is useful for operations, but it is not a secure admin boundary. Any password check implemented only in browser JavaScript can be read, bypassed, or reset by a user with access to the page.

The architecture choice to use Make.com webhooks instead of exposing the Airtable API directly was directionally correct. It avoids shipping Airtable API keys to the browser. However, public browser-to-Make webhooks are still public endpoints and must be treated as untrusted input. The secure version is:

```text
Public browser form -> thin protected backend/serverless endpoint -> Make.com -> Airtable/WhatsApp/PDF
```

or, if staying browser-to-Make for the MVP:

```text
Public browser form -> Make webhook with strict validation, rate limiting, idempotency, and approval status -> Airtable
```

## Findings

### Critical: `admin.html` is publicly reachable and protected only in client-side JS

Files:

- `src/admin.html`

Current behavior:

- Default password is embedded in the source: `DEFAULT_ADMIN_PWD = 'kitchen2024'`.
- Changed password is stored only in browser `localStorage`.
- Login state is stored in `sessionStorage` as `kc_admin_ok`.
- A browser console can bypass the gate by setting the expected session value.

Risk:

- Anyone who can load the page can inspect the source and understand or bypass the admin gate.
- A password change in one browser does not protect access from another browser.

Required next action:

- Do not keep `admin.html` publicly available without hosting-level protection.
- Enable Vercel Deployment Protection / Password Protection, or move admin to a separate protected project/subdomain.
- Long-term: replace static admin authentication with a server-side auth boundary.

### High: Make webhook URLs are callable by anyone who obtains them

Files:

- `src/order-form.html`
- `src/admin.html`

Current behavior:

- Order submission, voucher validation, menu fetch, settings load/save, and route-specific webhooks are browser-callable URLs.
- The frontend should be considered fully public.

Risk:

- Fake orders can be posted directly to Make.
- Voucher checks or order status flows can be abused.
- Admin settings save webhook could be abused if exposed.

Required next action:

- Every Make scenario must validate payload shape and required fields.
- Add idempotency keys to order submissions.
- Add rate limits / duplicate detection in Make or an intermediate backend.
- For admin-only actions, require a real server-side secret or protect the endpoint behind an authenticated backend.

Decision:

- Browser-to-Make is acceptable for public order intake only if every order starts in a pending/manager-approval state and Make treats the request as untrusted.
- Browser-to-Make is not acceptable for admin settings updates unless the endpoint is protected outside the browser.

### High: XSS risk from data rendered with `innerHTML`

Files:

- `src/order-form.html`
- `src/order-hub.html`
- `src/admin.html`

Examples:

- Order type cards render title/sub/icon via `innerHTML`.
- Dishes from menu webhook render fields via `innerHTML`.
- Announcements and contact settings render admin-provided content.

Risk:

- If malicious HTML enters Airtable, Make, or local settings, it can execute in customer/admin browsers.

Required next action:

- Escape all dynamic text before inserting into `innerHTML`, or use `textContent` / DOM node construction.
- Sanitize URL fields and allow only `https:`, `tel:`, `mailto:`, and known safe schemes.
- Add a Content Security Policy at hosting level to reduce script injection impact.

### Medium: Meta security headers are not enough

Files:

- `src/admin.html`

Current behavior:

- `X-Frame-Options` is set as a `<meta>` tag.

Risk:

- Several security controls must be real HTTP response headers, not HTML meta tags.

Required next action:

- Add `vercel.json` headers:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `X-Robots-Tag: noindex, nofollow`
  - A conservative `Content-Security-Policy`

## Architecture Recommendation

### Was choosing webhooks over direct API a mistake?

No. It was the better choice compared with direct Airtable API calls from the browser.

Direct Airtable API from the frontend would expose an Airtable token or require an unsafe proxy pattern. A webhook layer is better because it lets Make own the Airtable credential and workflow logic.

The correction is not "go back to direct API." The correction is "do not treat a public webhook as secret or trusted."

### Recommended target architecture

For MVP:

```text
order-form.html
  -> public Make order webhook
  -> strict validation
  -> create order as Pending Manager Approval
  -> manager approval step
  -> WhatsApp/customer confirmation only after approval
```

For admin:

```text
Protected admin area
  -> server-side auth / hosting password
  -> protected settings endpoint
  -> Make/Airtable settings update
```

For the more durable version:

```text
Frontend
  -> Vercel Serverless Function / Supabase Edge Function
  -> verifies auth, rate limit, origin, schema, idempotency
  -> calls Make webhook or Airtable
```

This preserves Make as the orchestration layer while removing trust from the browser.

## Practical Priority Order

1. Protect `admin.html` at Vercel/hosting level before using it for real webhook/settings data.
2. Change default admin password, but do not rely on that as the real protection.
3. Add Make-side validation and pending status for every public order submission.
4. Fix XSS rendering in `order-form.html` and `order-hub.html`.
5. Add HTTP security headers through `vercel.json`.
6. Decide whether admin settings should move to a protected serverless endpoint before launch.

## Open Questions For Next Session

- Is Vercel Password Protection available on the current project/account?
- Should `admin.html` remain in the same deployed project, or move to a separate protected deployment?
- Which Make webhooks are public customer intake, and which are admin-only?
- Do we need a thin Vercel Function now, or is Make-side validation sufficient for the first live test?
