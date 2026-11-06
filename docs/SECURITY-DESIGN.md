# Security Design — Review Draft

## Current Firebase state
- Authentication: Email/Password enabled.
- Firestore currently denies all reads and writes.
- Keep the existing deny-all Rules until the production rules pass review.
- No customer or project data should be entered during setup.

## Role model
- `admin`: manages users, customers, projects, transfer approvals, claim duration, archive and reports.
- `sale`: creates a new customer/project, sees records assigned to them, adds permitted follow-up activities, and submits transfer requests.
- Role and active state are read from `users/{uid}`; client-side UI checks are not a security boundary.

## Ownership and transfer
- Sale cannot write `ownerSaleId` directly.
- Transfer requests are proposals only.
- Only Admin can approve and execute a transfer.
- The ownership change, project owner updates, transfer status, ownership history and audit log must be one atomic transaction/batch with bounded project count.
- If a customer has too many projects for one atomic transaction, the operation must be rejected for Admin-assisted staged migration with a safe lock; never partially transfer silently.

## Concurrency
- Client duplicate checks are advisory only.
- A transaction must read all exact lock documents before creating any of them.
- First successful transaction reserves the canonical key.
- Failed/conflicting transactions must show the existing owner and prevent project creation.
- Rules must verify authenticated UID, role, immutable owner fields, server timestamps and paired lock writes using `getAfter()` where applicable.

## Duplicate matching limitations
- Canonicalize Vietnamese mobile numbers before submitting (e.g. equivalent 0-prefixed and +84 forms).
- Exact primary phone is the strongest customer identity key.
- Secondary phone, customer name and address similarity are additional warning signals.
- Similarity matching is not a safe identity proof and should route to Admin review.
- Firestore Rules cannot execute Unicode normalization, hashing or fuzzy string comparison. Do not rely on client-only normalization for a hard security guarantee.

## Spark plan
- No Cloud Functions, scheduled functions or server-only backend is required for the first phase.
- Do not enable Blaze.
- Expiration is evaluated when records are accessed or by Admin review; no automatic background notification job is promised.

## Release gates
1. Review schema and ownership invariants.
2. Implement and test Security Rules in emulator/test environment.
3. Test simultaneous duplicate submissions from two authenticated Sale users.
4. Test that Sale cannot modify owner, role, expiry, or archive fields.
5. Test Admin transfer and full project ownership consistency.
6. Only then publish Rules to Firebase.
