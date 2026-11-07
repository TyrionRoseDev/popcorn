# Theme tokens

This is the proposal for Popcorn's design tokens. It replaces the three stacked eras in `src/styles.css` (sea template, shadcn and drive-in) with one semantic set. The mock-ups under `src/routes/app/mock/` use exactly these values. `GRAMMAR.md` says where the theme may appear. This page says what it is made of.

Popcorn is dark only. Phase 1 found no user can reach the theme toggle and 1,827 of 1,832 token uses ignore it (`05-design-drift.md`, Light and dark). The `.light` path and the OS switch go.

## Colour

The source of truth is `docs/redesign/theme/tools/tokens.ts`. Run `bun docs/redesign/theme/tools/tokens.ts` to print the table below. It exits 1 if any pair falls under its minimum. `--css <file>` writes the same values as CSS variables, which is how the mock got them.

| Token | Value | Role |
| --- | --- | --- |
| `bg` | `#08080F` | The page, the night lot. |
| `surface-1` | `#11111D` | Cards, list groups, the header. |
| `surface-2` | `#1A1A2A` | Dialogs, sheets, inputs, secondary buttons, toasts. |
| `surface-3` | `#24243A` | Hovered, pressed and selected rows, chips. |
| `border` | `#2C2C44` | Hairlines between rows and around cards. Decorative, so no contrast minimum. |
| `border-strong` | `#6A6888` | Edges that identify a control, such as inputs and secondary buttons. |
| `text-1` | `#F4EFE3` | Titles and body text. A warm screen white, replacing `cream` and its 28 alpha steps. |
| `text-2` | `#C4BEB0` | Secondary text, such as notes, labels and inactive tabs. |
| `text-3` | `#9D988D` | Meta text, dates, placeholders. The faintest text allowed. |
| `accent` | `#FFB800` | Primary button fill, active tab line, progress. |
| `accent-text` | `#FFC53D` | Amber used as text, and stars. |
| `on-accent` | `#1B1300` | Text on `accent`. |
| `danger` | `#FF7A7A` | Error text, destructive outline, destructive confirm fill. |
| `on-danger` | `#1F0606` | Text on a `danger` fill. |
| `success` | `#5DD39E` | Success text and icons. |
| `focus` | `#00E5FF` | The focus ring, 2 px with a 2 px offset. Nothing else is cyan. |
| `neon-pink` | `#FF2D78` | Theme. Logo, landing, empty states, celebration headings. |
| `neon-cyan` | `#00E5FF` | Theme. Logo cycle on landing only. |
| `bulb` | `#FFB800` | Theme. Marquee and celebration bulbs. |
| `bulb-off` | `#5A4515` | Theme. An unlit bulb, for a chase. |
| `marquee-panel` | `#F6EFD9` | Theme, literal direction. The lit letter board. |
| `marquee-letter` | `#14110A` | Theme. Black letters on the board. |
| `marquee-letter-red` | `#A3121A` | Theme. The red second line on the board. |
| `ticket` | `#EFD9A0` | Theme. Stub paper. |
| `ticket-ink` | `#2A1C02` | Theme. Stub text. |
| `ticket-ink-2` | `#6A5020` | Theme. Stub meta text. |

### Contrast, measured

Text needs 4.5:1. Large text, meaning 24 px regular or 18.66 px bold and up, needs 3:1. Control edges and the focus ring need 3:1 against what sits next to them (WCAG 1.4.11). All 34 pairs pass. Ratios use the WCAG 2.2 relative luminance formula on opaque values.

| Foreground | Background | Use | Ratio | Needs | Result |
| --- | --- | --- | --- | --- | --- |
| `text-1` #F4EFE3 | `bg` #08080F | Body text on the page | 17.40:1 | 4.5:1 | Pass |
| `text-1` #F4EFE3 | `surface-1` #11111D | Body text on a card | 16.32:1 | 4.5:1 | Pass |
| `text-1` #F4EFE3 | `surface-2` #1A1A2A | Body text in a dialog or input | 14.94:1 | 4.5:1 | Pass |
| `text-1` #F4EFE3 | `surface-3` #24243A | Body text on a hovered or selected row | 13.18:1 | 4.5:1 | Pass |
| `text-2` #C4BEB0 | `bg` #08080F | Secondary text on the page | 10.78:1 | 4.5:1 | Pass |
| `text-2` #C4BEB0 | `surface-1` #11111D | Secondary text on a card | 10.11:1 | 4.5:1 | Pass |
| `text-2` #C4BEB0 | `surface-2` #1A1A2A | Secondary text in a dialog | 9.26:1 | 4.5:1 | Pass |
| `text-2` #C4BEB0 | `surface-3` #24243A | Secondary text on a selected row | 8.17:1 | 4.5:1 | Pass |
| `text-3` #9D988D | `bg` #08080F | Meta text and placeholders on the page | 6.95:1 | 4.5:1 | Pass |
| `text-3` #9D988D | `surface-1` #11111D | Meta text on a card | 6.52:1 | 4.5:1 | Pass |
| `text-3` #9D988D | `surface-2` #1A1A2A | Placeholder in an input | 5.97:1 | 4.5:1 | Pass |
| `text-3` #9D988D | `surface-3` #24243A | Meta text on a selected row | 5.26:1 | 4.5:1 | Pass |
| `on-accent` #1B1300 | `accent` #FFB800 | Primary button label | 10.62:1 | 4.5:1 | Pass |
| `accent-text` #FFC53D | `bg` #08080F | Amber text, active nav, on the page | 12.65:1 | 4.5:1 | Pass |
| `accent-text` #FFC53D | `surface-1` #11111D | Amber text and stars on a card | 11.86:1 | 4.5:1 | Pass |
| `accent-text` #FFC53D | `surface-2` #1A1A2A | Amber text in a dialog | 10.86:1 | 4.5:1 | Pass |
| `danger` #FF7A7A | `bg` #08080F | Error text on the page | 7.91:1 | 4.5:1 | Pass |
| `danger` #FF7A7A | `surface-1` #11111D | Error text on a card | 7.41:1 | 4.5:1 | Pass |
| `danger` #FF7A7A | `surface-2` #1A1A2A | Error text in a dialog or under an input | 6.79:1 | 4.5:1 | Pass |
| `on-danger` #1F0606 | `danger` #FF7A7A | Destructive confirm button label | 7.65:1 | 4.5:1 | Pass |
| `success` #5DD39E | `surface-1` #11111D | Success text on a card | 10.05:1 | 4.5:1 | Pass |
| `success` #5DD39E | `surface-2` #1A1A2A | Success text in a toast | 9.20:1 | 4.5:1 | Pass |
| `neon-pink` #FF2D78 | `bg` #08080F | Neon display text, landing and celebrations | 5.61:1 | 3:1 | Pass |
| `neon-cyan` #00E5FF | `bg` #08080F | Neon display text | 12.98:1 | 3:1 | Pass |
| `marquee-letter` #14110A | `marquee-panel` #F6EFD9 | Marquee letters on the lit panel | 16.39:1 | 4.5:1 | Pass |
| `marquee-letter-red` #A3121A | `marquee-panel` #F6EFD9 | Red second line on the lit panel, 20 px bold | 6.87:1 | 3:1 | Pass |
| `ticket-ink` #2A1C02 | `ticket` #EFD9A0 | Stub text | 11.94:1 | 4.5:1 | Pass |
| `ticket-ink-2` #6A5020 | `ticket` #EFD9A0 | Stub meta text | 5.43:1 | 4.5:1 | Pass |
| `focus` #00E5FF | `bg` #08080F | Focus ring against the page | 12.98:1 | 3:1 | Pass |
| `focus` #00E5FF | `surface-2` #1A1A2A | Focus ring against a dialog | 11.14:1 | 3:1 | Pass |
| `border-strong` #6A6888 | `surface-1` #11111D | Input and secondary button edge on a card | 3.52:1 | 3:1 | Pass |
| `border-strong` #6A6888 | `surface-2` #1A1A2A | Input edge in a dialog | 3.22:1 | 3:1 | Pass |
| `accent` #FFB800 | `bg` #08080F | Primary button edge against the page | 11.51:1 | 3:1 | Pass |
| `bulb` #FFB800 | `bg` #08080F | Lit bulb against the page | 11.51:1 | 3:1 | Pass |

For comparison, the nav text the current design intends, `text-cream/35` on the page, measures 3.06:1 (`05-design-drift.md`, item 1). No proposed text token goes below 5.26:1.

Two rules keep this true in code. Text never uses an alpha step of a token, because alpha changes the ratio with every background. Neon colours never carry body text, only display text at 24 px and up.

## Type

Four families, each with one job.

| Family | Token | Job |
| --- | --- | --- |
| Manrope | `font-body` | All UI and body text. |
| Righteous | `font-display` | Page titles, the marquee title. Never under 24 px. |
| Space Mono | `font-data` | Dates, episode codes, entry numbers, counts. Never under 12 px, letter spacing 0.02em at most. |
| Bungee Shade | `font-logo` | The word POPCORN only. |

Fraunces goes. Only the unused `.display-title` loads it.

Seven sizes. No body text under 14 px. No control label under 12 px, and buttons use 14 px.

| Token | Size / line height | Use |
| --- | --- | --- |
| `text-caption` | 12 / 16 | Tab bar labels, chips, field labels, cast character names. |
| `text-small` | 14 / 20 | Buttons, secondary body, row meta, notes in lists. |
| `text-body` | 16 / 24 | Body text, synopsis, inputs. |
| `text-h3` | 20 / 28, weight 700 | Card and section headings, month headings. |
| `text-h2` | 24 / 32, display | Empty state headings, dialog titles. |
| `text-h1` | 32 / 40, display | Page titles. |
| `text-display` | 48 / 52, display | Marquee title at 768 px and up. It falls to `text-h1` on a phone. |

Letter spacing is 0 except `font-data` at 0.02em. Pixel tracking such as `tracking-[2px]` goes, since it does not scale with the text.

## Spacing, radius and shadow

Spacing is a 4 px scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Tailwind's default scale already matches it, and Phase 1 found only 12 arbitrary spacing values, so this is mostly a rule against adding more.

Page gutter is 16 px under 1024 px and 32 px from 1024 px. Content is at most 1200 px wide.

| Radius token | Value | Use |
| --- | --- | --- |
| `radius-sm` | 4 px | Posters, small badges. |
| `radius-md` | 8 px | Buttons, inputs, banners, the marquee. |
| `radius-lg` | 12 px | Cards, dialogs, sheets. |
| `radius-full` | 999 px | Avatars, chips. |

| Shadow token | Value | Use |
| --- | --- | --- |
| `shadow-raised` | `0 2px 8px rgb(0 0 0 / 0.45)` | Menus and popovers. |
| `shadow-overlay` | `0 16px 48px rgb(0 0 0 / 0.6)` | Dialogs and sheets. |
| `glow-bulb` | `0 0 6px rgb(255 184 0 / 0.7)` | Theme. Lit bulbs. |
| `glow-neon` | `0 0 12px rgb(255 45 120 / 0.55)` | Theme. Neon headings and the logo. |

Cards on the page use a border, not a shadow. There are two glows. Today there are 195 distinct shadow values and no token behind them.

Z-index has four layers: `header` 10, `tabbar` 10, `overlay` 50 for dialogs and sheets, `toast` 60.

## Components

One pattern per role. Everything a user taps is at least 44 by 44 px and has a visible text label, or an `aria-label` when it is an icon.

| Role | Pattern |
| --- | --- |
| Button, primary | `accent` fill, `on-accent` text, 14 px bold, 44 px tall, 16 px side padding, `radius-md`. One per screen region. Used for Add entry, Save, Accept, Find friends. |
| Button, secondary | `surface-2` fill, 1 px `border-strong` inset edge, `text-1`. Want to watch, Recommend, Add friend, Watched E5. |
| Button, quiet | No fill or edge, `text-2`, `surface-3` on hover. Edit, Play trailer on an image, inline row actions. |
| Button, danger | `danger` 1 px edge and `danger` text. The confirm inside the destructive dialog is a `danger` fill with `on-danger` text. |
| Card | `surface-1`, 1 px `border`, `radius-lg`, 20 px padding under 768 px and 24 px above. Heading `text-h3`. |
| Dialog and sheet | Radix `Dialog`, which all 26 dialogs already use. `surface-2`, `radius-lg`, `shadow-overlay`, a scrim of `rgb(0 0 0 / 0.6)`. Under 768 px it is a bottom sheet. Width 480 px for forms, 640 px for the Add entry sheet. Title `text-h2`, close button top right with `aria-label="Close"`, actions bottom right with primary last. One dialog at a time. |
| Input | `surface-2`, 1 px `border-strong`, `radius-md`, 44 px tall, `text-body`, placeholder `text-3`. Label above in `text-caption` `text-2`. Error text below in `danger` `text-small`, linked with `aria-describedby`. |
| Tabs | `role="tablist"` and `role="tab"`. 44 px tall, `text-small` 600 weight, `text-2`. Selected is `text-1` with a 2 px `accent` underline. A 1 px `border` line under the row. |
| List row | Fixed grid: date or leading slot, poster 48 by 72, text block, one 44 px overflow button that is always visible. Title `text-body` bold, year `text-small` `text-3`, meta row with stars and chips, note `text-small` `text-2` clamped to 2 lines. 1 px `border` between rows. |
| Empty state | Centred. A 64 px outlined icon in `neon-pink`, a `text-h2` heading that says what is missing, one `text-body` sentence on what fills it, one primary button for the next step. It never shows on a failed request. |
| Loading state | A skeleton in the shape of the content: `surface-2` blocks at the size of the real rows, no spinner, no text. Under 300 ms it shows nothing. It never uses the intermission clock. |
| Error state | Inline, where the content would be: a `text-h3` heading naming what failed ("Your diary did not load"), `text-small` `text-2` cause if known, and a secondary Retry button. Never empty-state copy. |
| Toast | Bottom centre on a phone above the tab bar, bottom right from 1024 px. `surface-2`, `radius-md`, `shadow-raised`, `text-small`. Success icon in `success`, error icon in `danger`. 4 seconds, paused on hover and focus, and never placed over the control that triggered it. One at a time. |
| Celebration | A banner at the top of the page the user lands on after the task ends, never during it. `surface-2` with an amber outlined icon, a dismiss button, and in the literal direction a bulb frame. It queues, one at a time. |
| Poster | `radius-sm`, `object-fit: cover`, 2:3, a 1 px inner light edge so dark posters keep their shape. Sizes 32, 40, 48, 64, 260 px wide. Decorative, so `alt=""` when the title is printed next to it. Always through `getTmdbImageUrl`. |
| Avatar | Circle, 24, 32 or 40 px, photo or initial on a per-person colour. |
| Stars | `accent-text` filled, `border-strong` empty, 16 px, with `role="img"` and an `aria-label` such as "Rated 4 of 5". |

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `dur-fast` | 120 ms | Hover, press, colour changes. |
| `dur-base` | 200 ms | Tabs, toggles, row insert, toast in. |
| `dur-enter` | 280 ms | Dialog and sheet in. Exit is `dur-base`. |
| `dur-celebrate` | 600 ms | A celebration banner in, and one bulb chase. |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Everything that moves on screen. |
| `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Things leaving. |

What may animate: `opacity`, `transform`, and colour on interaction. Nothing animates layout properties. No animation runs forever. The bulb chase runs once, for at most 1.2 seconds, on a celebration or the landing page. Today's 104 to 169 infinite animations per page fall to zero.

Under `prefers-reduced-motion: reduce`, transforms are dropped, fades shorten to 120 ms, the bulb chase and confetti do not run, and bulbs show lit and still. Every JS animator reads the preference. The `motion` library gets it from one `MotionConfig reducedMotion="user"` at the root, and `canvas-confetti` gets `disableForReducedMotion: true`. The CSS block also zeroes `animation-delay`, so a delayed entrance does not wait.

## What happens to each current token

Every custom property in `src/styles.css` today.

### Sea template, 19 tokens, removed

`--sea-ink`, `--sea-ink-soft`, `--lagoon`, `--lagoon-deep`, `--palm`, `--sand`, `--foam`, `--surface`, `--surface-strong`, `--line`, `--inset-glint`, `--kicker`, `--bg-base`, `--header-bg`, `--chip-bg`, `--chip-line`, `--link-bg-hover`, `--hero-a`, `--hero-b`. They reach users only through the unlayered `body`, `a` and `code` rules, which paint the nav teal. Remove them with those rules, and with `.page-wrap`, `.display-title`, `.island-shell`, `.island-kicker`, `.feature-card`, `.nav-link`, `.rise-in`, `.site-footer`.

### shadcn, 32 colour variables and `--radius` with their aliases, pointed at the new set

shadcn primitives in `src/components/ui` read these names, so the names stay and their values point at the semantic tokens. One value each, no `.dark` copy.

| Current | Becomes |
| --- | --- |
| `--background` | `var(--bg)` |
| `--foreground` | `var(--text-1)` |
| `--card`, `--popover` | `var(--surface-2)` |
| `--card-foreground`, `--popover-foreground` | `var(--text-1)` |
| `--primary` | `var(--accent)` |
| `--primary-foreground` | `var(--on-accent)` |
| `--secondary`, `--muted`, `--accent` | `var(--surface-3)` |
| `--secondary-foreground`, `--accent-foreground` | `var(--text-1)` |
| `--muted-foreground` | `var(--text-3)` |
| `--destructive` | `var(--danger)` |
| `--border` | `var(--border)` |
| `--input` | `var(--border-strong)` |
| `--ring` | `var(--focus)` |
| `--radius` | `8px`, with `--radius-sm` 4, `--radius-md` 8, `--radius-lg` 12, `--radius-xl` removed |
| `--destructive-foreground`, `--chart-1` to `--chart-5`, `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` | Remove, with their `--color-*` aliases. No file outside `src/components/ui` imports the chart or sidebar primitives, checked with grep on this branch. |

The `--color-*` aliases for the kept names stay, so `bg-background` and friends keep working.

### Drive-in, 10 tokens

| Current | Decision | New token |
| --- | --- | --- |
| `--color-neon-pink` `#FF2D78` | Keep, theme only | `neon-pink` |
| `--color-neon-cyan` `#00E5FF` | Rename. Its UI job becomes focus. Theme use stays for the landing logo | `focus`, `neon-cyan` |
| `--color-neon-amber` `#FFB800` | Rename | `accent`, `bulb`, and `accent-text` `#FFC53D` for text |
| `--color-drive-in-bg` `#050508` | Rename, value `#08080F` so the surface steps are even | `bg` |
| `--color-drive-in-card` `#0a0a1e` | Rename, value `#11111D` | `surface-1` |
| `--color-drive-in-border` `#1a1a2e` | Rename, value `#2C2C44` so a hairline shows against `surface-1` | `border` |
| `--color-cream` `#fffff0` | Rename. Its 28 alpha steps become three text levels | `text-1`, `text-2`, `text-3` |
| `--font-sans` Manrope | Rename | `font-body` |
| `--font-display` Righteous | Keep | `font-display` |
| `--font-mono-retro` Space Mono | Rename, and fix the 11 `font-mono` uses that fall back to the system monospace | `font-data` |
| `--font-logo` Bungee Shade | Keep | `font-logo` |

### Keyframes

Keep `bulb-chase`, run once. Keep `celebration-fade-in`, renamed `enter-fade`. Remove the rest: `rise-in`, `neon-cycle` except on landing, `marquee-pulse`, `twinkle`, `grain`, `vhs-scan`, `chase`, `footer-flicker`, `sway-left`, `sway-right`, `fog-drift-1` to `-3`, `fog-crawl`, `blink-cursor`, `fade-cursor`, `shimmer-sweep`, `scroll-reel`, `dust-float`, `projector-flicker`, `screen-entrance`, `button-underglow-pulse`, `neon-flicker`, `sweep-hand`, `scratch-flicker`, `pulse-text`, `check-bounce`, `row-flash`, `plasma-shift`, `arcade-bounce`. The `.cta-push` button goes with them, and landing uses the primary button.

New tokens with no current equivalent: `surface-2`, `surface-3`, `border-strong`, `danger`, `on-danger`, `success`, the type scale, the shadow set, the motion set and the z-index layers. Phase 1 named these as the gaps where drift is worst.
