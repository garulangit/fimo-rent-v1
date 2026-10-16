# Managed account deletion

`deleteManagedUser` is a Firebase Callable Function that deletes a selected Firebase Authentication account and its corresponding `userRoles/{uid}` document. It is deliberately not enabled in the browser by default.

The function requires an authenticated caller with an active role document and either the `superadmin` role or the existing `users.manage` custom permission. It rejects self-deletion, rejects invalid target roles, prevents a non-superadmin from deleting a superadmin, and transactionally protects the last active superadmin from concurrent deletion requests. It marks the target inactive before deleting the Firebase Authentication user, so a failed or interrupted Auth deletion fails closed and can be retried. Firebase Admin credentials are supplied by the managed Cloud Functions runtime; no service-account key belongs in this repository or `public/`.

## Deployment and activation

1. Review the function code and project billing/runtime requirements.
2. Deploy only the callable to the Firebase project after explicit operational approval: `firebase deploy --only functions:deleteManagedUser --project dashboard-branding-transjogja`.
3. After confirming the deployed function is available in `us-central1`, set `accountDeletionEnabled` to `true` in `public/firebase-config.js` and deploy the hosting update. Until then, the Akun tab keeps its Hapus action disabled.

The Auth deletion and Firestore document deletion are separate service operations rather than one atomic transaction. If Auth deletion succeeds but role-document deletion fails, retrying the callable cleans up the remaining role document when Firebase Auth reports that the user is already absent. Check Cloud Functions logs before retrying an `internal` error.
