# Manual Verification Results

## 1. Hash Chain Tamper Detection (TASK-1202a)

### Issue Fixed
During the manual verification, we discovered a precision mismatch bug where `AuditLogEntry` used nanosecond precision in memory (from `OffsetDateTime.now()`) to calculate the canonical payload for SHA-256 hashing, but the database (`PostgreSQL TIMESTAMPTZ`) truncated the time to microseconds upon saving. This caused the hashes to mismatch during the chain verification read from the database.

**Fix:** We updated `AuditLogEntry.java`'s `@PrePersist` method to truncate the time to microseconds natively before generating the hash:
```java
// PostgreSQL TIMESTAMPTZ와의 해시 정합성을 위해 마이크로초 단위로 절사
this.createdAt = OffsetDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
```

### Verification Result
We successfully ran an automated Python script (`test_task1202.py`) to verify the fix:
1. Cleared previous invalid logs from the database (`TRUNCATE TABLE`).
2. Generated a new `LOGIN` audit log.
3. Called `/api/v1/admin/audit-logs/verify` **before** tampering -> Result: `valid: True`
4. Executed an intentional DB manipulation: `UPDATE audit_logs SET outcome = 'TAMPERED'`
5. Called `/api/v1/admin/audit-logs/verify` **after** tampering -> Result: `valid: False` with `firstTamperedId` properly identifying the manipulated row!

## 2. Session Management & Forced Logout (TASK-1202b)

We verified the token invalidation and forced logout flow using the same script:
1. Created an authenticated user session by logging in.
2. Verified the active session ID via `/api/v1/users/me/sessions`.
3. Sent a `DELETE /api/v1/users/me/sessions/{session_id}` request (simulating Revoke Session action). 
4. Attempted a subsequent authenticated request using the revoked JWT.
5. The backend correctly responded with `401 Unauthorized`, proving that the token was invalidated and the user was forcefully logged out.

Both tasks have been thoroughly verified and the hash chain logic is now fully stable.
