# Firebase Security Specification

## Data Invariants
1. A ChatSession can only exist if it has a valid userId that matches the current user.
2. A Message can only belong to a valid ChatSession.
3. Access to ChatSession and Messages is strictly isolated to the user who owns them.

## The "Dirty Dozen" Payloads
1. Create ChatSession with mismatching userId
2. Create Message with mismatching userId
3. Create ChatSession without createdAt
4. Create Message with oversized text (simulating denial of wallet)
5. Update ChatSession changing userId
6. Update Message changing sender
7. Read another user's ChatSession
8. Read another user's Messages
9. List all ChatSessions globally
10. Update ChatSession fields that shouldn't change
11. Send extra fields not in schema
12. Miss required fields

## The Test Runner
A `firestore.rules.test.ts` file will verify these.
