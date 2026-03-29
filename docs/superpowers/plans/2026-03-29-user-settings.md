# User Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings page where users can change their profile picture, username, and email, and delete their account.

**Architecture:** A new route at `/app/settings` renders a settings list. Each setting row opens a dialog for editing. The auth server config is updated to enable `changeEmail` and `deleteUser`. A new email template handles email change verification.

**Tech Stack:** TanStack Router, better-auth (changeEmail + deleteUser), UploadThing (avatar upload), Radix Dialog, Resend (email), React Email

**Spec:** `docs/superpowers/specs/2026-03-29-user-settings-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/auth.ts` | Enable `changeEmail` and `deleteUser` in server config |
| Create | `src/emails/change-email.tsx` | Email template for email change verification |
| Modify | `src/integrations/better-auth/header-user.tsx` | Add Settings link to dropdown |
| Create | `src/routes/app/settings.tsx` | Settings page route with settings list UI |
| Create | `src/components/settings/change-avatar-dialog.tsx` | Avatar upload dialog |
| Create | `src/components/settings/change-username-dialog.tsx` | Username edit dialog |
| Create | `src/components/settings/change-email-dialog.tsx` | Email change dialog |
| Create | `src/components/settings/delete-account-dialog.tsx` | Account deletion confirmation dialog |

---

### Task 1: Enable changeEmail and deleteUser in auth server config

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/emails/change-email.tsx`

- [ ] **Step 1: Create the email change verification email template**

Create `src/emails/change-email.tsx` following the same structure as `src/emails/magic-link.tsx`. Use the same Tailwind config, fonts, colors, and film-strip divider pattern. Change the badge to "Email Change", the heading to "Verify your new email", the body text to explain the verification, and the button text to "Verify Email".

```tsx
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  pixelBasedPreset,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface ChangeEmailProps {
  url: string;
}

export default function ChangeEmailEmail({ url }: ChangeEmailProps) {
  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                "drive-in": "#0c0c1a",
                "drive-in-card": "#0f1025",
                "drive-in-border": "#1a1a2e",
                "neon-pink": "#FF2D78",
                "neon-amber": "#FFB800",
                cream: "#fffff0",
                "ticket-bg": "#12132a",
                "ticket-header": "#FFB800",
              },
            },
          },
        }}
      >
        <Head>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
          `}</style>
        </Head>
        <Preview>Verify your new email address</Preview>
        <Body
          className="bg-drive-in"
          style={{ fontFamily: "'Manrope', sans-serif", margin: 0, padding: 0 }}
        >
          <Container className="mx-auto max-w-lg py-10 px-4">
            {/* Header */}
            <Container
              className="mx-auto rounded-t-2xl px-10 pt-10 pb-8 text-center"
              style={{
                backgroundColor: "#0f1025",
                border: "1px solid #1e1e3a",
                borderBottom: "none",
              }}
            >
              <Container className="mx-auto mb-5" style={{ width: "fit-content" }}>
                <Text
                  className="m-0 px-5 py-2 text-center text-xs font-bold uppercase tracking-widest text-neon-amber"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    border: "1.5px dashed rgba(255,184,0,0.5)",
                    letterSpacing: "4px",
                  }}
                >
                  Email Change
                </Text>
              </Container>
              <Heading
                className="m-0 text-4xl font-bold text-cream"
                style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "6px" }}
              >
                POPCORN
              </Heading>
              <Text
                className="m-0 mt-2 text-sm text-cream/50"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                Best enjoyed with popcorn.
              </Text>
            </Container>

            {/* Film strip divider */}
            <Container style={{ backgroundColor: "#2a2a3e", padding: "6px 12px" }}>
              <Row>
                {Array.from({ length: 24 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: generated component
                  <Column key={i} style={{ width: `${100 / 24}%`, textAlign: "center" }}>
                    <Container
                      style={{
                        width: "14px",
                        height: "10px",
                        backgroundColor: "#3d3d55",
                        borderRadius: "2px",
                        margin: "0 auto",
                      }}
                    />
                  </Column>
                ))}
              </Row>
            </Container>

            {/* Ticket stub */}
            <Container
              className="mx-auto"
              style={{
                backgroundColor: "#12132a",
                border: "1px solid #1e1e3a",
                borderTop: "none",
                paddingBottom: "0",
              }}
            >
              <Section style={{ padding: "0 24px" }}>
                <Container
                  style={{
                    backgroundColor: "#FFB800",
                    borderRadius: "8px 8px 0 0",
                    padding: "12px 20px",
                    marginTop: "20px",
                  }}
                >
                  <Row>
                    <Column>
                      <Text
                        className="m-0 text-sm font-bold uppercase tracking-widest"
                        style={{
                          fontFamily: "'Space Mono', monospace",
                          color: "#0c0c1a",
                          letterSpacing: "3px",
                        }}
                      >
                        Verify
                      </Text>
                    </Column>
                  </Row>
                </Container>
              </Section>

              <Section style={{ padding: "0 24px" }}>
                <Container
                  style={{
                    backgroundColor: "#171835",
                    padding: "28px 24px 32px",
                    borderLeft: "1px solid #1e1e3a",
                    borderRight: "3px dashed #2a2a3e",
                    borderBottom: "1px solid #1e1e3a",
                    borderRadius: "0 0 8px 8px",
                  }}
                >
                  <Heading
                    className="m-0 mb-3 text-2xl font-bold text-cream"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    Verify your new email.
                  </Heading>
                  <Text className="m-0 mb-6 text-base leading-relaxed text-cream/60">
                    Tap the button below to confirm this as your new email address. This
                    link is single-use and will expire shortly.
                  </Text>
                  <Button
                    href={url}
                    className="rounded-lg bg-neon-pink px-8 py-4 text-center text-sm font-bold uppercase tracking-widest text-cream no-underline"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      letterSpacing: "2px",
                      boxShadow: "0 0 24px rgba(255,45,120,0.3)",
                    }}
                  >
                    Verify Email
                  </Button>
                  <Text className="m-0 mt-6 text-xs leading-relaxed text-cream/35">
                    If the button does not work, copy and paste this link into your
                    browser:{" "}
                    <Link
                      href={url}
                      className="text-neon-amber/70 underline"
                      style={{ wordBreak: "break-all" }}
                    >
                      {url}
                    </Link>
                  </Text>
                </Container>
              </Section>

              <Container style={{ padding: "16px 24px 20px", textAlign: "center" }}>
                <Row>
                  <Column style={{ textAlign: "left" }}>
                    <Container
                      style={{
                        width: "6px",
                        height: "6px",
                        backgroundColor: "#2a2a3e",
                        borderRadius: "50%",
                        display: "inline-block",
                      }}
                    />
                  </Column>
                  <Column style={{ textAlign: "right" }}>
                    <Container
                      style={{
                        width: "6px",
                        height: "6px",
                        backgroundColor: "#2a2a3e",
                        borderRadius: "50%",
                        display: "inline-block",
                      }}
                    />
                  </Column>
                </Row>
              </Container>
            </Container>

            {/* Footer */}
            <Container style={{ padding: "0 12px" }}>
              <Container
                style={{ borderTop: "2px dashed #2a2a3e", marginTop: "24px", paddingTop: "20px" }}
              >
                <Text
                  className="m-0 text-center text-xs text-cream/30"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  If you didn't request this change, you can safely ignore this email.
                </Text>
              </Container>
            </Container>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

ChangeEmailEmail.PreviewProps = {
  url: "http://localhost:3000/api/auth/verify-email?token=abc123&callbackURL=/app/settings",
} satisfies ChangeEmailProps;
```

- [ ] **Step 2: Update auth server config to enable changeEmail and deleteUser**

In `src/lib/auth.ts`, add the `changeEmail` and `deleteUser` options to the `user` config, and import the new email template:

```ts
// Add at top of file:
import ChangeEmailEmail from "#/emails/change-email";

// Then update the user config object to add these properties alongside the existing additionalFields:
user: {
  changeEmail: {
    enabled: true,
    sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
      const html = await render(ChangeEmailEmail({ url }));
      const { error } = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: newEmail,
        subject: "Verify your new email — Popcorn",
        html,
      });
      if (error) {
        console.error("Failed to send change email verification:", error);
        throw new Error("Failed to send verification email");
      }
    },
  },
  deleteUser: {
    enabled: true,
  },
  additionalFields: {
    // ... existing fields unchanged
  },
},
```

- [ ] **Step 3: Verify the dev server starts without errors**

Run: `bun run dev`
Expected: Server starts without type errors or config issues.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/emails/change-email.tsx
git commit -m "feat: enable changeEmail and deleteUser in auth config, add email template"
```

---

### Task 2: Add Settings link to profile dropdown

**Files:**
- Modify: `src/integrations/better-auth/header-user.tsx`

- [ ] **Step 1: Add Settings menu item to dropdown**

Add a `Settings` link between the existing "Hidden Titles" item and the separator. Import `Settings` icon from lucide-react.

In `src/integrations/better-auth/header-user.tsx`, add the import:

```tsx
import { EyeOff, LogOut, Settings } from "lucide-react";
```

Then add this menu item after the Hidden Titles `DropdownMenuItem` and before the `DropdownMenuSeparator`:

```tsx
<DropdownMenuItem asChild>
  <Link
    to="/app/settings"
    className="text-cream/60 no-underline focus:bg-cream/5 focus:text-cream/80"
  >
    <Settings className="mr-2 h-4 w-4" />
    Settings
  </Link>
</DropdownMenuItem>
```

- [ ] **Step 2: Verify the dropdown renders correctly**

Start the dev server and check:
- Profile dropdown shows Settings between Hidden Titles and Sign Out
- Clicking Settings navigates to `/app/settings` (will 404 for now — that's expected)

- [ ] **Step 3: Commit**

```bash
git add src/integrations/better-auth/header-user.tsx
git commit -m "feat: add Settings link to profile dropdown menu"
```

---

### Task 3: Create the settings page route with settings list

**Files:**
- Create: `src/routes/app/settings.tsx`

- [ ] **Step 1: Create the settings route with static layout**

Create `src/routes/app/settings.tsx`. The page shows the user's current profile info in a list of clickable rows. Each row will later open a dialog. For now, wire up the state for which dialog is open but render placeholder dialogs.

Use `authClient.useSession()` to get the current user data. Follow the TanStack Router pattern from other routes (e.g., `src/routes/app/search.tsx`).

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Camera, ChevronRight, Mail, Trash2, User } from "lucide-react";
import { useState } from "react";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: "Settings — Popcorn" }],
  }),
});

function SettingsPage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const [avatarOpen, setAvatarOpen] = useState(false);
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-8 font-display text-2xl text-cream">Settings</h1>

      <div className="overflow-hidden rounded-xl border border-cream/8 bg-drive-in-card">
        {/* Profile Picture */}
        <button
          type="button"
          onClick={() => setAvatarOpen(true)}
          className="flex w-full items-center gap-4 border-b border-cream/8 px-4 py-3.5 text-left transition-colors hover:bg-cream/4"
        >
          <Camera className="h-4 w-4 shrink-0 text-cream/40" />
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <span className="text-sm text-cream/60">Profile Picture</span>
            <div className="ml-auto flex items-center gap-2">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cream/10">
                  <span className="text-xs text-cream/40">
                    {user.username?.charAt(0).toUpperCase() || "?"}
                  </span>
                </div>
              )}
              <ChevronRight className="h-4 w-4 text-cream/20" />
            </div>
          </div>
        </button>

        {/* Username */}
        <button
          type="button"
          onClick={() => setUsernameOpen(true)}
          className="flex w-full items-center gap-4 border-b border-cream/8 px-4 py-3.5 text-left transition-colors hover:bg-cream/4"
        >
          <User className="h-4 w-4 shrink-0 text-cream/40" />
          <div className="flex flex-1 items-center justify-between min-w-0">
            <span className="text-sm text-cream/60">Username</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-cream/40 truncate max-w-[200px]">
                {user.username || "Not set"}
              </span>
              <ChevronRight className="h-4 w-4 text-cream/20" />
            </div>
          </div>
        </button>

        {/* Email */}
        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-cream/4"
        >
          <Mail className="h-4 w-4 shrink-0 text-cream/40" />
          <div className="flex flex-1 items-center justify-between min-w-0">
            <span className="text-sm text-cream/60">Email</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-cream/40 truncate max-w-[200px]">
                {user.email}
              </span>
              <ChevronRight className="h-4 w-4 text-cream/20" />
            </div>
          </div>
        </button>
      </div>

      {/* Danger Zone */}
      <div className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-cream/30">
          Danger Zone
        </h2>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-neon-pink/15 bg-neon-pink/5 px-4 py-3.5 text-left text-sm text-neon-pink/70 transition-colors hover:bg-neon-pink/10 hover:text-neon-pink"
        >
          <Trash2 className="h-4 w-4" />
          Delete Account
        </button>
      </div>

      {/* Dialogs — will be added in subsequent tasks */}
      {/* <ChangeAvatarDialog open={avatarOpen} onOpenChange={setAvatarOpen} /> */}
      {/* <ChangeUsernameDialog open={usernameOpen} onOpenChange={setUsernameOpen} /> */}
      {/* <ChangeEmailDialog open={emailOpen} onOpenChange={setEmailOpen} /> */}
      {/* <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} /> */}
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders**

Navigate to `/app/settings` in the browser.
Expected: Settings list renders with profile picture, username, and email rows plus the delete button. Clicking rows does nothing visible yet (dialogs commented out).

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/settings.tsx
git commit -m "feat: add settings page route with settings list layout"
```

---

### Task 4: Change Avatar dialog

**Files:**
- Create: `src/components/settings/change-avatar-dialog.tsx`
- Modify: `src/routes/app/settings.tsx` (wire up dialog)

- [ ] **Step 1: Create the avatar change dialog component**

Create `src/components/settings/change-avatar-dialog.tsx`. Reuse the UploadThing pattern from the onboarding avatar step (`src/routes/onboarding/index.tsx` lines 147-244).

```tsx
import { generateReactHelpers } from "@uploadthing/react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { authClient } from "#/lib/auth-client";
import type { UploadRouter } from "#/lib/uploadthing";

const { useUploadThing } = generateReactHelpers<UploadRouter>({
  url: "/api/uploadthing",
});

interface ChangeAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatarUrl: string | null | undefined;
  fallbackInitial: string;
}

export function ChangeAvatarDialog({
  open,
  onOpenChange,
  currentAvatarUrl,
  fallbackInitial,
}: ChangeAvatarDialogProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { startUpload, isUploading } = useUploadThing("avatarUploader", {
    onClientUploadComplete: async (res) => {
      if (res?.[0]) {
        setIsSaving(true);
        try {
          const { error: updateError } = await authClient.updateUser({
            avatarUrl: res[0].ufsUrl,
          });
          if (updateError) {
            setError(updateError.message ?? "Failed to save avatar");
          } else {
            onOpenChange(false);
          }
        } finally {
          setIsSaving(false);
        }
      }
    },
    onUploadError: (err) => {
      setError(err.message);
    },
  });

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setPreview(null);
      setError("");
    }
    onOpenChange(nextOpen);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    await startUpload([file]);
  }

  const busy = isUploading || isSaving;
  const displaySrc = preview || currentAvatarUrl;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-cream">
            Profile Picture
          </DialogTitle>
          <DialogDescription className="text-cream/40">
            Upload a new profile picture.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {error && (
            <p className="text-sm text-neon-pink">{error}</p>
          )}

          <label className="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-cream/20 transition-colors hover:border-neon-cyan/40">
            {displaySrc ? (
              <img
                src={displaySrc}
                alt="Avatar preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-cream/10 text-2xl text-cream/30 group-hover:text-neon-cyan/60">
                {fallbackInitial}
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={busy}
              className="hidden"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="text-xs font-medium text-cream">Change</span>
            </div>
          </label>

          {busy && (
            <p className="text-xs text-neon-cyan/60">
              {isSaving ? "Saving..." : "Uploading..."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire up the dialog in the settings page**

In `src/routes/app/settings.tsx`:

Add the import:
```tsx
import { ChangeAvatarDialog } from "#/components/settings/change-avatar-dialog";
```

Replace the `{/* <ChangeAvatarDialog ... /> */}` comment with:
```tsx
<ChangeAvatarDialog
  open={avatarOpen}
  onOpenChange={setAvatarOpen}
  currentAvatarUrl={user.avatarUrl}
  fallbackInitial={user.username?.charAt(0).toUpperCase() || "?"}
/>
```

- [ ] **Step 3: Verify avatar change works**

In browser: Settings > click Profile Picture row > dialog opens > upload image > avatar updates.
Expected: Avatar updates in the settings row and in the header dropdown after dialog closes.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/change-avatar-dialog.tsx src/routes/app/settings.tsx
git commit -m "feat: add change avatar dialog to settings"
```

---

### Task 5: Change Username dialog

**Files:**
- Create: `src/components/settings/change-username-dialog.tsx`
- Modify: `src/routes/app/settings.tsx` (wire up dialog)

- [ ] **Step 1: Create the username change dialog component**

Create `src/components/settings/change-username-dialog.tsx`. Follow the same validation rules as onboarding: 3-24 chars, alphanumeric + underscore.

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { authClient } from "#/lib/auth-client";

interface ChangeUsernameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUsername: string | null | undefined;
}

export function ChangeUsernameDialog({
  open,
  onOpenChange,
  currentUsername,
}: ChangeUsernameDialogProps) {
  const [username, setUsername] = useState(currentUsername ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setUsername(currentUsername ?? "");
      setError("");
    }
    onOpenChange(nextOpen);
  }

  async function handleSave() {
    setError("");
    setLoading(true);
    try {
      const { error: updateError } = await authClient.updateUser({ username });
      if (updateError) {
        setError(updateError.message ?? "Username may be taken");
      } else {
        onOpenChange(false);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }

  const isValid = username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
  const isUnchanged = username === (currentUsername ?? "");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-cream">
            Username
          </DialogTitle>
          <DialogDescription className="text-cream/40">
            3-24 characters, letters, numbers, and underscores only.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {error && <p className="text-sm text-neon-pink">{error}</p>}

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            minLength={3}
            maxLength={24}
            pattern="^[a-zA-Z0-9_]+$"
            autoFocus
            disabled={loading}
            className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none disabled:opacity-50"
          />
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleClose(false)}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || isUnchanged || loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/45 bg-neon-cyan/10 px-5 py-2 text-sm font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/18 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire up the dialog in the settings page**

In `src/routes/app/settings.tsx`:

Add the import:
```tsx
import { ChangeUsernameDialog } from "#/components/settings/change-username-dialog";
```

Replace the username dialog comment with:
```tsx
<ChangeUsernameDialog
  open={usernameOpen}
  onOpenChange={setUsernameOpen}
  currentUsername={user.username}
/>
```

- [ ] **Step 3: Verify username change works**

In browser: Settings > click Username row > dialog opens > change username > save.
Expected: Username updates in settings list and across the app.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/change-username-dialog.tsx src/routes/app/settings.tsx
git commit -m "feat: add change username dialog to settings"
```

---

### Task 6: Change Email dialog

**Files:**
- Create: `src/components/settings/change-email-dialog.tsx`
- Modify: `src/routes/app/settings.tsx` (wire up dialog)

- [ ] **Step 1: Create the email change dialog component**

Create `src/components/settings/change-email-dialog.tsx`. This calls `authClient.changeEmail()` which triggers a verification email. The dialog shows a success message after submission.

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { authClient } from "#/lib/auth-client";

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
}

export function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
}: ChangeEmailDialogProps) {
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setNewEmail("");
      setError("");
      setSent(false);
    }
    onOpenChange(nextOpen);
  }

  async function handleSave() {
    setError("");
    setLoading(true);
    try {
      const { error: changeError } = await authClient.changeEmail({
        newEmail,
        callbackURL: "/app/settings",
      });
      if (changeError) {
        setError(changeError.message ?? "Failed to send verification email");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail);
  const isSameEmail = newEmail.toLowerCase() === currentEmail.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-cream">
            Email Address
          </DialogTitle>
          <DialogDescription className="text-cream/40">
            {sent
              ? "Check your inbox to verify the change."
              : `Currently ${currentEmail}`}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="py-4 text-center">
            <p className="text-sm text-cream/60">
              We sent a verification link to{" "}
              <span className="font-medium text-neon-cyan">{newEmail}</span>.
              Click the link to confirm your new email.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 py-2">
              {error && <p className="text-sm text-neon-pink">{error}</p>}

              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="New email address"
                autoFocus
                disabled={loading}
                className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none disabled:opacity-50"
              />
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => handleClose(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isValidEmail || isSameEmail || loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/45 bg-neon-cyan/10 px-5 py-2 text-sm font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/18 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Verification"}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire up the dialog in the settings page**

In `src/routes/app/settings.tsx`:

Add the import:
```tsx
import { ChangeEmailDialog } from "#/components/settings/change-email-dialog";
```

Replace the email dialog comment with:
```tsx
<ChangeEmailDialog
  open={emailOpen}
  onOpenChange={setEmailOpen}
  currentEmail={user.email}
/>
```

- [ ] **Step 3: Verify email change flow**

In browser: Settings > click Email row > dialog opens > enter new email > click Send Verification.
Expected: Success message appears. Verification email sent (check Resend dashboard or email inbox).

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/change-email-dialog.tsx src/routes/app/settings.tsx
git commit -m "feat: add change email dialog with verification flow to settings"
```

---

### Task 7: Delete Account dialog

**Files:**
- Create: `src/components/settings/delete-account-dialog.tsx`
- Modify: `src/routes/app/settings.tsx` (wire up dialog)

- [ ] **Step 1: Create the delete account dialog component**

Create `src/components/settings/delete-account-dialog.tsx`. Requires typing "DELETE" to confirm. All user data is cascade-deleted by database foreign keys.

```tsx
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { authClient } from "#/lib/auth-client";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: DeleteAccountDialogProps) {
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmation("");
      setError("");
    }
    onOpenChange(nextOpen);
  }

  async function handleDelete() {
    setError("");
    setLoading(true);
    try {
      const { error: deleteError } = await authClient.deleteUser();
      if (deleteError) {
        setError(deleteError.message ?? "Failed to delete account");
        setLoading(false);
      } else {
        navigate({ to: "/" });
      }
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  const isConfirmed = confirmation === "DELETE";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-neon-pink">
            Delete Account
          </DialogTitle>
          <DialogDescription className="text-cream/40">
            This action is permanent and cannot be undone. All your data
            including watchlists, swipe history, and preferences will be deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {error && <p className="text-sm text-neon-pink">{error}</p>}

          <label className="text-xs text-cream/40">
            Type <span className="font-mono font-bold text-cream/60">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
            autoFocus
            disabled={loading}
            className="w-full rounded-lg border border-neon-pink/20 bg-neon-pink/5 px-3.5 py-3 text-sm text-cream placeholder:text-cream/20 focus:border-neon-pink/40 focus:outline-none disabled:opacity-50"
          />
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleClose(false)}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-neon-pink/45 bg-neon-pink/10 px-5 py-2 text-sm font-bold text-neon-pink transition-colors hover:bg-neon-pink/18 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Deleting..." : "Delete Account"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire up the dialog in the settings page**

In `src/routes/app/settings.tsx`:

Add the import:
```tsx
import { DeleteAccountDialog } from "#/components/settings/delete-account-dialog";
```

Replace the delete dialog comment with:
```tsx
<DeleteAccountDialog
  open={deleteOpen}
  onOpenChange={setDeleteOpen}
/>
```

- [ ] **Step 3: Verify delete account flow**

In browser: Settings > click Delete Account > dialog opens > type "DELETE" > button enables.
Expected: Dialog renders with confirmation input. Button is disabled until "DELETE" is typed exactly. (Do NOT actually click delete on a real account during testing — verify visually only unless using a test account.)

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/delete-account-dialog.tsx src/routes/app/settings.tsx
git commit -m "feat: add delete account dialog with confirmation to settings"
```

---

### Task 8: Final verification and cleanup

**Files:**
- Review: all files modified/created in Tasks 1-7

- [ ] **Step 1: Run the dev server and do a full walkthrough**

Run: `bun run dev`

Test all flows:
1. Profile dropdown shows "Settings" link
2. Settings page loads at `/app/settings` with all three rows + delete button
3. Change avatar: upload works, avatar updates everywhere
4. Change username: save works, username updates across app
5. Change email: sends verification email, shows success message
6. Delete account: confirmation dialog works, button disabled until "DELETE" typed

- [ ] **Step 2: Run type checking**

Run: `bun run typecheck` (or `bunx tsc --noEmit`)
Expected: No type errors.

- [ ] **Step 3: Run linting**

Run: `bun run lint` (or `bunx biome check`)
Expected: No lint errors in new files.

- [ ] **Step 4: Fix any issues found in steps 1-3**

If any issues, fix them and commit.

- [ ] **Step 5: Final commit if any fixes were needed**

Stage only the files that were fixed, then commit:
```bash
git commit -m "fix: address issues from settings feature review"
```
