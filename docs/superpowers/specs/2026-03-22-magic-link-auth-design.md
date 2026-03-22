# Magic Link Authentication & Onboarding

## Overview

Passwordless authentication using Better Auth's magic link plugin with Resend for email delivery. Single `/login` entry point for all users. New users are routed through a gated onboarding flow before accessing the app.

## Auth Infrastructure

### Better Auth Configuration

- Replace `emailAndPassword` with the `magicLink` plugin (imported from `better-auth/plugins/magic-link`)
- Add Drizzle database adapter to `auth.ts` (currently has no DB connection — it needs one for sessions, users, and verification tokens)
- `sendMagicLink` callback renders a React Email template and sends via Resend
- TanStack Start cookies plugin remains for session handling
- Auth handler stays at `/api/auth/$`

### Database

Docker Compose with PostgreSQL (port 5432, volume-persisted).

**Tables:**
- Better Auth core tables: `user`, `session`, `account`, `verification` (generated via better-auth CLI)
- Extended user fields via better-auth's `user.additionalFields` config: `username` (unique, text), `avatarUrl` (text, nullable), `onboardingCompleted` (boolean, default false). This extends the `user` table directly so these fields are accessible on the session user object.

### Environment Variables (all via t3-env)

| Variable | Type | Description |
|---|---|---|
| `DATABASE_URL` | server | PostgreSQL connection string (exists in .env.local, needs adding to t3-env) |
| `BETTER_AUTH_URL` | server | Better Auth base URL (exists in .env.local, needs adding to t3-env) |
| `BETTER_AUTH_SECRET` | server | Better Auth secret (exists in .env.local, needs adding to t3-env) |
| `RESEND_API_KEY` | server | Resend API key for sending emails |
| `RESEND_FROM_EMAIL` | server | Sender email address for outbound emails (e.g., `noreply@popcorn.app`) |
| `UPLOADTHING_TOKEN` | server | UploadThing token for avatar uploads |

## Routes & Auth Flow

### Route Structure

```
src/routes/
  __root.tsx              (existing — providers, layout)
  index.tsx               (existing — landing page)
  login.tsx               (new — magic link form)
  api/auth/$.ts           (existing — better-auth handler)
  app/
    route.tsx             (auth guard — checks session + onboardingCompleted)
    index.tsx             (/app — authenticated home)
  onboarding/
    route.tsx             (onboarding guard — checks session + !onboardingCompleted)
    index.tsx             (/onboarding — step-based flow)
```

### Flow

1. User enters email on `/login` → magic link sent → UI swaps to "check your email" state
2. User clicks link in email → better-auth verifies token, creates session
3. Magic link's `callbackURL` is set to `/app`. The `app/route.tsx` auth guard handles the onboarding check:
   - `onboardingCompleted === false` → redirect to `/onboarding`
   - `onboardingCompleted === true` → proceed to `/app`
4. Onboarding is gated — user cannot navigate to `/app` until completed
5. On final step completion, `onboardingCompleted` set to `true`, redirect to `/app`

### Auth Guards

- `app/route.tsx`: requires session AND `onboardingCompleted === true`. No session → `/login`. Not completed → `/onboarding`.
- `onboarding/route.tsx`: requires session AND `onboardingCompleted === false`. Already completed → `/app`. No session → `/login`.

## Login Page

Two states on the same page, toggled by local state:

### State 1: Email Entry
- Email input field
- "Send Magic Link" button (neon pink CTA)
- "Back to home" link

### State 2: Check Your Email
- Confirmation icon
- "Magic link sent!" heading
- Shows the email address the link was sent to
- Expiry notice (10 minutes)
- "Didn't get it? Resend" link

## Onboarding Flow

### Architecture

Step registry pattern: an array of step configuration objects, each defining a component, validation logic, and label. Adding a future step (e.g., genre preferences) means adding one entry to the array.

Progress is shown via `StepIndicator` component (dots: active = neon pink, done = neon cyan).

Each step saves to the server on "Next/Continue" — progress is not lost if the user closes the tab.

### Step 1: Username
- Text input for username
- Inline uniqueness validation
- "Continue" button (cyan CTA)

### Step 2: Avatar
- UploadThing-powered image upload with circular preview
- "Finish" button (cyan CTA)
- "Skip for now" link (sets avatarUrl to null, still completes onboarding)

## Shared Components

| Component | Props | Description |
|---|---|---|
| `AuthLayout` | `children` | Full-page wrapper: drive-in background, vignette, retro overlays, vertically centered content |
| `MarqueeBadge` | `text` | The "✦ Text ✦" pill with pulse animation and amber neon styling |
| `AuthCard` | `children` | Glass card: dark background, border, blur backdrop, consistent padding |
| `StepIndicator` | `steps: number`, `current: number` | Progress dots showing completed vs active vs upcoming steps |

### Composition

```
Login:       <AuthLayout> → <MarqueeBadge text="Welcome Back" />   → <AuthCard>
Check Email: <AuthLayout> → <MarqueeBadge text="Check Your Inbox" /> → <AuthCard>
Onboarding:  <AuthLayout> → <MarqueeBadge text="Setting Up" />    → <AuthCard> → <StepIndicator>
```

## Email Templates

### Setup

- React Email components in `src/emails/`
- `@react-email/tailwind` for inline styling
- `dev:email` npm script: `"email dev -d src/emails"` runs the React Email preview server

### Magic Link Email

Branded to match the drive-in aesthetic:
- Dark background matching `--color-drive-in-bg`
- Neon accent colors for the CTA button
- Manrope font family
- POPCORN branding in header
- Brief copy: "Click to sign in"
- Prominent CTA button with neon styling
- Expiry notice in footer
- Rendered via `render()` from `@react-email/render`, passed to Resend's `send()`

## Existing UI Updates

### Landing Page (`index.tsx`)
- Both CTA buttons ("Log In" and "Create an Account") point to `/login`
- Update second button copy to "Get Started" (both go to same place)

### Header (`HeaderUser` component)
- Authenticated: show avatar + username, sign-out option (calls `authClient.signOut()`, redirects to `/`)
- Unauthenticated: show "Log In" link to `/login`

## Dependencies to Add

| Package | Purpose |
|---|---|
| `resend` | Email sending service |
| `@react-email/components` | React Email component library |
| `@react-email/tailwind` | Tailwind CSS support in emails |
| `react-email` | Dev preview server |
| `uploadthing` | Server-side UploadThing SDK |
| `@uploadthing/react` | React components for UploadThing |

## Docker Compose

```yaml
services:
  db:
    image: postgres:17
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: popcorn
      POSTGRES_PASSWORD: popcorn
      POSTGRES_DB: popcorn
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

`DATABASE_URL=postgresql://popcorn:popcorn@localhost:5432/popcorn`
