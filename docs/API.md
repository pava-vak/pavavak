# PaVa-Vak API Notes

This file is a lightweight current-reference note for the active APIs used by the Android app and web UI.

## Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `POST /api/auth/request-password-reset`
- `POST /api/auth/complete-password-reset`
- `POST /api/auth/verify-2fa`

## Users

- `GET /api/users/profile`
- `PUT /api/users/profile`
- `POST /api/users/change-password`
- `DELETE /api/users/delete-account`

## Messages

- `GET /api/messages/conversations/list`
- `GET /api/messages/:userId`
- `POST /api/messages/send`
- `PUT /api/messages/:messageId/read`
- `PUT /api/messages/:userId/read-all`
- `PUT /api/messages/:messageId/edit`
- `DELETE /api/messages/:messageId`
- `DELETE /api/messages/conversation/:userId/clear`
- `GET /api/messages/media/:mediaId`

## Admin

- `GET /api/admin/dashboard/stats`
- `GET /api/admin/users`
- `GET /api/admin/users/pending`
- `POST /api/admin/users/:userId/approve`
- `POST /api/admin/users/:userId/reset-password`
- `GET /api/admin/password-resets/pending`
- `POST /api/admin/password-resets/:requestId/generate-otp`
- `POST /api/admin/password-resets/:requestId/dismiss`

## Mobile / FCM

- `POST /api/mobile/register-token`
- `POST /api/mobile/unregister-token`

## Current Gaps

- Full request/response schema documentation is still incomplete.
- Deployment verification for background FCM is still operational, not documentation-only.
