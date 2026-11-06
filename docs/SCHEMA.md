# ĐỨC ANH PROJECT — Firestore Schema (Draft)

> Draft for review. No collection is created by this document. No Firestore data is written.

## Collections

| Collection | Document ID | Purpose |
|---|---|---|
| users | Firebase Auth UID | Role, display name, active status, sales profile |
| customers | Auto ID | Customer master record and current Sale owner |
| projects | Auto ID | One elevator project under a customer |
| customer_locks | Canonical primary phone | First-writer ownership reservation |
| project_locks | Deterministic project key | Exact project/address reservation proposal |
| transfer_requests | Auto ID | Sale-to-Sale customer transfer request |
| project_activities | Auto ID | Follow-up and progress timeline |
| ownership_history | Auto ID | Immutable owner-change history |
| audit_logs | Auto ID | Admin and security audit events |

## Important fields

### users/{uid}
- role: `admin` | `sale`
- displayName: string
- email: string
- active: boolean
- createdAt: server timestamp
- updatedAt: server timestamp

Only Admin manages roles and activation. A user must never be able to promote their own role.

### customers/{customerId}
- displayName: string
- primaryPhone: canonical string
- secondaryPhone: optional canonical string
- normalizedName: string (search aid, not identity proof)
- ownerSaleId: UID
- status: `active` | `archived`
- claimStartedAt: server timestamp
- claimExpiresAt: timestamp (default 30 days; Admin-adjustable)
- createdAt / updatedAt: server timestamps

### projects/{projectId}
- customerId: string
- projectName: string
- address: string
- normalizedAddress: string (search aid, not identity proof)
- provinceCity: string
- projectType: string
- buildingSize: optional string
- floors: optional number
- expectedElevatorQuantity: optional number
- expectedDeploymentAt: optional timestamp
- expectedLoadKg: number (required)
- stops: number (required)
- ownerSaleId: UID (must match customer owner)
- status: `new` | `survey` | `consulting` | `quoted` | `negotiating` | `signed` | `lost`
- archived: boolean
- createdAt / updatedAt: server timestamps

### transfer_requests/{requestId}
- customerId: string
- fromSaleId: UID
- toSaleId: UID
- requestedBy: UID
- reason: string
- status: `pending` | `approved` | `rejected`
- reviewedBy: optional UID
- reviewedAt: optional timestamp
- createdAt: server timestamp

### ownership_history/{historyId}
- customerId: string
- previousSaleId: UID
- newSaleId: UID
- changedBy: Admin UID
- reason: string
- changedAt: server timestamp

## Data integrity constraints

1. A customer has exactly one current Sale owner.
2. All projects belonging to a customer inherit that same owner.
3. A transfer changes customer ownership and every related project's owner atomically.
4. A transfer request does not itself change ownership.
5. Archive is reversible and never physically deletes customer/project records.
6. Expired claims go to Admin review; they are never automatically released.
7. The 30-day claim window is configurable by Admin.
8. Fuzzy name/address matches create review warnings; they must not automatically merge different people or projects.

## Locking caveat

Firestore transactions are atomic, but Firestore Security Rules cannot run arbitrary normalization or fuzzy matching. A lock scheme can enforce exact keys only when the key is independently verifiable in Rules. The implementation must not claim fuzzy duplicate prevention is guaranteed by Rules. The production design will use a verified canonical primary phone lock for ownership, while address/name similarity is an Admin-review signal unless a trusted server is introduced. No Cloud Functions/Blaze dependency is planned.
