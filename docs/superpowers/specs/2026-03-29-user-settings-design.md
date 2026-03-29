# User Settings Page

## Overview

A settings page (`/app/settings`) accessible from the profile dropdown menu. Displays profile fields in a list — clicking a row opens a dialog to edit that field. Includes account deletion with confirmation.

## Route

- **Path:** `/app/settings`
- **Protection:** Same as other `/app/*` routes (requires auth + onboarding)
- **Head title:** "Settings — Popcorn"

## Profile Dropdown Change

Add a "Settings" menu item with a gear icon to the existing dropdown in `src/integrations/better-auth/header-user.tsx`, linking to `/app/settings`.

## Server Auth Config Changes

Enable `changeEmail` and `deleteUser` in `src/lib/auth.ts`:

```ts
user: {
  changeEmail: {
    enabled: true,
    sendChangeEmailVerification: async ({ user, newEmail, url }) => {
      // Send verification email via Resend (same pattern as magic link)
    },
  },
  deleteUser: {
    enabled: true,
  },
  additionalFields: { /* existing fields */ },
},
```

## Settings Page Layout

A centered card with the page title and a list of setting rows. Each row shows:
- Label (e.g. "Username")
- Current value (e.g. "cinephile42")
- A chevron or edit indicator

Clicking a row opens a dialog to edit that field.

### Setting Rows

1. **Profile Picture** — shows current avatar thumbnail, click to open avatar change dialog
2. **Username** — shows current username, click to open username edit dialog
3. **Email** — shows current email, click to open email change dialog

### Danger Zone

Below the settings list, a visually distinct "Delete Account" button. Clicking opens a confirmation dialog.

## Dialogs

### Change Profile Picture Dialog

- Shows current avatar (large preview)
- File input to upload new image via UploadThing (reuse `avatarUploader` endpoint)
- Shows upload progress
- Calls `authClient.updateUser({ avatarUrl })` on upload complete
- Cancel / Save flow

### Change Username Dialog

- Text input pre-filled with current username
- Same validation as onboarding: 3-24 chars, alphanumeric + underscore
- Calls `authClient.updateUser({ username })`
- Shows error if username is taken (better-auth returns error; username has unique constraint in DB schema)

### Change Email Dialog

- Text input for new email address (not pre-filled — user types the new one)
- Calls `authClient.changeEmail({ newEmail })` which triggers a verification email
- On success, shows confirmation message: "Check your email to verify the change"
- The email only updates after the user clicks the verification link
- Session refreshes automatically after verification

### Delete Account Dialog

- Warning text explaining this action is permanent and all data will be lost
- Requires typing "DELETE" to confirm
- Calls `authClient.deleteUser()` — since this is a passwordless (magic link) app, no password is required
- On success, redirects to landing page (`/`)
- Related user data (watchlists, shuffle swipes, hidden titles, genre preferences) is cleaned up via database cascade deletes on the foreign key constraints

## Auth Client Methods

- `authClient.updateUser({ username })` — update username
- `authClient.updateUser({ avatarUrl })` — update avatar
- `authClient.changeEmail({ newEmail })` — triggers email verification flow
- `authClient.deleteUser()` — deletes user account (no password needed for magic link auth)

## Styling

Follows existing drive-in theme:
- `bg-drive-in-card` card background
- `border-cream/10` borders
- `text-cream` for primary text, `text-cream/50` for secondary
- `font-display` for headings
- Neon cyan accents for interactive elements
- Delete button uses `neon-pink` / destructive styling
- Dialogs use existing `Dialog` component from UI library

## Components

- **`src/routes/app/settings.tsx`** — route component with settings list
- **`src/components/settings/change-avatar-dialog.tsx`** — avatar upload dialog
- **`src/components/settings/change-username-dialog.tsx`** — username edit dialog
- **`src/components/settings/change-email-dialog.tsx`** — email change dialog
- **`src/components/settings/delete-account-dialog.tsx`** — account deletion confirmation

## Data Flow

- Current user data comes from `authClient.useSession()` (already available in the app context)
- All updates go through `authClient` methods which update the session automatically
- No additional tRPC procedures needed — better-auth handles profile updates, email change, and account deletion natively
- After any update, `useSession()` reflects the change (better-auth updates session cookies)

## Email Template

A new email template is needed for email change verification, following the same pattern as the existing magic link email at `src/emails/magic-link.tsx`. It should contain a verification link.
