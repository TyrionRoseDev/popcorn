# Design drift report

Popcorn's drive-in theme grew by accretion. This report measures where the design drifted, then separates the drift a user sees from the drift only a code reader sees. It proposes no restyle. Treat it as Phase 1 evidence for a product decision.

The short version:

- The biggest visible defect is not a token problem. Six unlayered rules in `src/styles.css` beat every Tailwind utility, so the nav renders a leftover template teal and hovering a link dims it.
- The theme's vocabulary is applied by shape, not by meaning. "Now Showing" labels both a film and the Feed page. A film strip is a person on one screen and a list on another.
- The app has one theme, not two. No user can reach the theme toggle, and only 5 of 1,832 token class uses can respond to a theme change.
- Modals are the good news. All 26 use Radix `Dialog`, and no hand-built overlay exists. The drift there is in skins, not implementation.

The scan covers the working tree on `0562c26`, so it includes the 9 uncommitted files in `src/`.

## Reproduce the numbers

| Artifact | Purpose |
| --- | --- |
| `docs/redesign/phase-1/tools/design-drift.ts` | Static scanner. Run `bun docs/redesign/phase-1/tools/design-drift.ts`. Takes about 5 seconds. Two runs produce byte-identical JSON. |
| `docs/redesign/phase-1/05-design-drift.json` | Every count below with its `file:line` list. |
| `docs/redesign/phase-1/tools/design-drift-runtime.mjs` | Browser probes. Run through `verify-popcorn drive` on a disposable stack. |
| `docs/redesign/phase-1/tools/design-drift-runtime.json` | Computed styles, contrast, and animation counts from those probes. |

The scanner parses TypeScript with the compiler API, so comments and type positions cannot inflate a count. Each file falls into one scope:

| Scope | Files | Meaning |
| --- | --- | --- |
| `app` | 155 | Product code a route can reach. Headline numbers use this scope. |
| `orphan` | 11 | Components no route imports. No user sees them, so they are reported apart. |
| `ui` | 56 | `src/components/ui`, shadcn. |
| `emails` | 2 | `src/emails`, inline by necessity. |
| `css` | 1 | `src/styles.css`. |

I checked the numbers against methods that share no code with the scanner. A plain grep finds 1,110 colour literals against the scanner's 1,095 before orphans moved out, and the gap is colours in comments. Grep confirms that `prefers-reduced-motion` appears only at `src/styles.css:653`, and that `<Button>` appears once in product code.

## Headline numbers

| Measure | Value | Notes |
| --- | --- | --- |
| Distinct colours | 312 | 128 base colours once alpha is ignored, 44 perceptual families at deltaE-OK 0.04. |
| Off-token colours | 168 | 154 without black and white overlays. 421 hits. |
| Raw colour literals | 987 | 758 inline style, 133 JS constants, 96 arbitrary classes. |
| Raw literals that an existing token could express | 660 of 987 | 529 are alpha variants of a token and 131 match one exactly. |
| Tailwind palette classes | 99 hits | Mostly `black/*` scrims and `red-*`. |
| Font sizes | 20 resolved px values | 23 class spellings, 13 of them arbitrary. |
| Font size hits below 12px | 259 | 87 of those are below 10px. |
| Arbitrary values | 1,069 hits, 350 distinct | `ui` has 143 hits. |
| Inline style properties | 1,134 | In JSX `style` props. |
| Dialogs | 26 sites, 1 implementation | 5 skin families and 9 widths. |
| Cards | 21 named uses, 59 raw card divs | 43 distinct visual signatures. `ui/card` is unused. |
| Buttons | 202 raw, 1 `ui/button`, 3 `ArcadeButton`, 1 `.cta-push`, 15 styled links | 145 distinct signatures among the raw buttons. |
| Keyframes | 41 defined, 38 used | 32 in `styles.css`, 10 in component `<style>` tags, 1 name collision. |
| Reduced-motion coverage | CSS full, JS 0 of 12 files | Details in [Motion](#motion). |
| Orphaned components | 11 product, 46 shadcn | |

## Drift a user would see

Ranked by how much a user notices it and how often. Each item says how I know.

### 1. Unlayered CSS overrides the nav and every link

`src/styles.css:218` sets `a { color: var(--lagoon-deep) }` outside any `@layer`. Tailwind v4 puts utilities in `@layer utilities`, and unlayered CSS beats layered CSS regardless of specificity. So `text-cream/35` at `src/routes/app/route.tsx:46` does nothing. The same rule is present at top level in the built CSS, `dist/client/assets/styles-DQiNhBl2.css`, so this ships.

Measured in a browser, not inferred:

- On all 8 routes probed, every visible link with a colour utility rendered the anchor default instead. That is 6 of 6 on most routes and 7 of 7 on two.
- Nav text is `rgb(141,229,219)`, the template's lagoon teal. That colour appears nowhere in the drive-in palette.
- The active tab stays teal. Only its underline turns pink, so `[&.active]:text-neon-pink` at `src/routes/app/route.tsx:49` never shows.
- Hover goes darker, not lighter. `src/styles.css:225` sets `#246f76`, which drops contrast from 13.9:1 to 3.5:1 at the moment a user points at the link.

`src/styles.css:291` does the same to motion. Every probed control with a `transition-*` or `duration-*` utility computed to the template's `0.18s` on `background-color, color, border-color, transform`. That was 7 of 7 on most routes and 10 of 10 on the tracker. Shadow and opacity changes on buttons and links snap instead of easing, whatever the class says.

One caution for Phase 2. Do not fix this by making the classes win as written. The teal measures 13.9:1 at rest, and the intended `text-cream/35` measures 3.06:1. The bug is accidentally more readable than the design.

### 2. Marquee vocabulary does not track meaning

`NOW SHOWING` sits above `The Matrix` at `src/components/title/now-showing-marquee.tsx:95`, and above `Feed`, `My Watchlists`, `Series Tracker`, and `f.r.i.e.n.d.s` at `src/components/watchlist/now-showing-header.tsx:78`. The first says something about a film. The others are page headings wearing the same words. Search, Settings, Profile, and tracker detail use a plain `<h1>`, so the same level of page has two heading systems. See [Theme](#theme).

### 3. Controls users need are the smallest things on screen

`Mark All`, the bulk action on a show, is `text-[7px]` at `src/routes/app/tracker.$tmdbId.tsx:750` and again at `:942`. There are 18 hits at 7px, 14 at 8px, and 55 at 9px. Many also carry `tracking-[2px]`, which spreads tiny letters further apart. `tracker.$tmdbId.tsx` alone has 10 hits at 7 or 8px, and `src/components/shuffle/action-buttons.tsx` has 4.

### 4. The same action looks different on each screen

Marking something watched is a round `ArcadeButton` at `src/components/title/title-actions.tsx:390` and a 7px text button on the tracker. A primary confirm is a bordered cyan block in onboarding at `src/components/onboarding/favourite-film-step.tsx:152`, a heavier 2px version at `src/components/watched/watched-with-modal.tsx:210`, and a cyan pill in settings dialogs. The landing page's main button is a 3D `.cta-push` that exists nowhere else, `src/routes/index.tsx:92`. The 202 raw buttons have 145 visual signatures. Many of those differ trivially, so read the number as an upper bound and the examples as the evidence.

### 5. Colour does not carry stable meaning

| Colour | What it means, by screen |
| --- | --- |
| Pink | Search and Friends tabs, the Watchlist action, errors at `src/components/auth/form-error.tsx:3`, and account deletion at `src/components/settings/delete-account-dialog.tsx:58`. |
| Cyan | Shuffle and Feed tabs, the Watched action, primary confirm buttons, unread notifications, In Progress status, and companion watch events. |
| Amber | Watchlists and Tracker tabs, the Invite action, marquee frames, Completed status at `src/components/tracker/tracker-show-card.tsx:132`, and shared watch events. |

Nav colours repeat pink, cyan, amber in tab order at `src/routes/app/route.tsx:124`, so they carry no meaning at all. Pink means both "add to my list" and "this failed or is destructive". A second error colour exists as well. `red-*` classes appear in 9 files, for example `src/routes/app/profile.$userId.tsx:415`, so an error is pink in one flow and red in another.

### 6. Empty and loading states have no shared form

No shared component exists for either. `ui/empty` and `ui/skeleton` are unused. 31 inline empty messages across 19 files vary in size, tone, and whether they offer a next step. Compare the action in `src/routes/app/feed.tsx:146` with the bare `text-[11px] text-cream/25` at `src/routes/app/profile.$userId.tsx:1400`. Loading is shown five ways: `animate-pulse` blocks (30 hits), `animate-spin` (19), `Loader2` icons (16), text such as "Loading" (29), and `CountdownLoader` (1).

### 7. Copy drift inside one screen

Settings shows `Favorite Film` at `src/routes/app/settings.tsx:206` directly above `Favourite Genre`. `src/components/settings/edit-genres-dialog.tsx:79` uses `Favorite Genres`. This is a small fix, and it is one of the few items a user can spot on a single screen without comparing pages.

### 8. Motion ignores people who ask for less

CSS animation stops correctly under reduced motion. Motion library and confetti effects have no guard. See [Motion](#motion).

## Noise

These counts look alarming and are not worth a user-facing fix on their own.

- **Distinct colours (312).** Most are alpha steps of cream and the three neons. The real issue is that nobody chose the steps, so `cream` has 26 of them. A short ramp solves it, and the count falls as a side effect.
- **Button and card signature counts.** A one-class difference counts as a new signature. Use these to find clusters, not to judge.
- **Dark near-black cluster.** 42 near-duplicate colours sit around the page and card backgrounds with 244 hits. A user cannot tell them apart. They matter for maintenance, not for perception.
- **The `shimmer-sweep` collision.** `src/routes/app/profile.$userId.tsx:94` redefines the keyframe from `src/styles.css:481` with different timing. It is real, and visible only as a slightly different shimmer.
- **shadcn internals.** `ui` has 143 arbitrary values. That is upstream code. Leave it alone.
- **46 unused shadcn primitives and 17 unused tokens.** They are dead weight with no user effect. Delete them when convenient.
- **Radius variety.** 27 class values, but `rounded-full`, `rounded-lg`, and `rounded-md` cover 368 of 521 hits.

## Colours

Token mapping for the 312 distinct `app` values:

| Status | Distinct values | Meaning |
| --- | --- | --- |
| `token-exact` | 12 | Same rgb and alpha as a token. |
| `token-alpha` | 132 | Same rgb as a token at another alpha. |
| `token-near` | 31 | Within deltaE-OK 0.02 of a token. Counted as off-token, because a near miss is drift. |
| `off-token` | 137 | No token within that distance. |

The bypass is mostly spelling, not new colours. 660 of 987 raw literals restate an existing token, usually as `rgba(0,229,255,0.3)` in a `boxShadow` where a class cannot reach. The neon glow is the driver, and no shadow token exists for it.

Largest alpha families:

| Base | Token | Alpha steps | Hits |
| --- | --- | --- | --- |
| `#fffff0` | `--color-cream` | 28 | 1,234 |
| `#00e5ff` | `--color-neon-cyan` | 27 | 466 |
| `#ffb800` | `--color-neon-amber` | 26 | 473 |
| `#ff2d78` | `--color-neon-pink` | 24 | 375 |
| `#ffffff` | none in the drive-in set | 15 | 62 |
| `#000000` | none | 14 | 124 |

10 near-duplicate clusters exist at deltaE-OK 0.02. Besides the dark cluster, warm projector tints such as `#fff0c8`, `#fff5d2`, and `#fff5dc` have no token and repeat by hand across Shuffle and the title page. Raw literals concentrate in `src/routes/app/profile.$userId.tsx` (252), `src/routes/app/tracker.$tmdbId.tsx` (173), `src/components/tracker/write-about-modal.tsx` (97), and `src/components/recommend/recommend-modal.tsx` (86).

## Type

| Property | App classes | Inline | `styles.css` | `ui` |
| --- | --- | --- | --- | --- |
| Font size | 23 | 12 | 3 | 6 |
| Font family | 5 | 1 | 2 | 2 |
| Font weight | 3 | 1 | 2 | 3 |
| Letter spacing | 13 | 5 | 1 | 2 |
| Line height | 7 | 1 | 0 | 4 |

Resolved sizes in px are 7, 8, 9, 10, 11, 12, 12.5, 13, 14, 15, 16, 18, 20, 22, 24, 30, 32, 36, 48, and 72. Five more sizes are computed at runtime or use `clamp`. The steps at 12 and 12.5, and at 11, 12, 13, show values added one at a time instead of chosen from a scale.

Families are clear in intent. `font-mono-retro` has 240 hits and `font-display` 95. `font-mono` has 11 hits and renders Tailwind's default monospace instead of Space Mono, because `src/styles.css` defines no `--font-mono`. See `src/components/recommend/recommend-modal.tsx:328`. It reads like a typo for `font-mono-retro`, and users get a second monospace font inside one modal. `src/styles.css:1` still downloads Fraunces, which only `.display-title` uses, and nothing uses that class.

Letter spacing mixes units. `tracking-[2px]` has 46 hits, `tracking-wider` 55, and `tracking-[0.12em]` 1. Pixel tracking does not scale with the text, so 2px on 7px type is far wider in proportion than 2px on 16px type.

## Spacing and sizing

| Measure | Distinct | Hits |
| --- | --- | --- |
| Arbitrary spacing such as `gap-[10px]` | 10 | 12 |
| Arbitrary sizing such as `w-[700px]` | 88 | 191 |
| Arbitrary position | 21 | 32 |
| Radius classes | 27 | 521 |
| Shadow classes | 82 | 143 |
| Inline shadows | 113 | |
| z-index classes | 11 | 69 |
| Inline z-index | 12 | |

Spacing is healthy. Only 12 arbitrary hits exist, so the Tailwind scale is doing its job. The arbitrary count is mostly type and glow, led by `text-*` (293), `tracking-*` (129), and `shadow-*` (96). Shadows are the weakest area, with 195 distinct values across classes and inline styles and no token behind them. z-index mixes classes with inline values such as `49`, `50`, and `51`, plus computed ones like `10 - stackIndex`.

## Components

| Role | Implementations | Same role, different implementation? |
| --- | --- | --- |
| Modal | `Dialog` 26, `Sheet` 2, custom overlays 0 | One implementation, 5 skins. |
| Card | `ui/card` 0, named `*Card` 21 uses, raw divs 59 | Yes. Each feature defines its own. |
| Button | Raw 202, `ui/button` 1, `ArcadeButton` 3, `.cta-push` 1, links as buttons 15 | Yes, and this is the widest role. |
| Input | Raw `input` 21, raw `textarea` 7, raw `select` 3, `ui/input` 0, `ui/textarea` 0 | Yes. 13 input signatures. Two `SearchBar` components exist, in `src/components/search` and `src/components/onboarding`. |
| Tabs | `ui/tabs` 0, hand-rolled 4 | Yes. No `role="tab"` anywhere. Sites are `src/routes/app/profile.$userId.tsx:1546`, `src/routes/app/tracker.index.tsx:287`, `src/components/achievements/achievement-grid.tsx:176`, `src/routes/app/feed.tsx:121`. |
| Toast | `toast()` 77 calls, `AchievementPopup`, `CompletionCelebration`, `MatchCelebration` | Different weights by design. See [Theme](#theme). |
| Empty state | Inline copy 31 in 19 files, `ui/empty` 0 | Yes. |
| Loading | Five forms, listed above | Yes. |
| Avatar | Raw `img` 16, initial-in-circle 7, named 4, `ui/avatar` 0 | Yes. 5 and 6 signatures. |
| Poster | Raw `img` 20 with 4 signatures, hardcoded TMDB URLs 7, `getTmdbImageUrl` 16 | Mostly consistent. The 7 hardcoded URLs bypass the helper. |

The five modal skins, with `file:line` lists in `dialogFamilies`:

| Family | Count | Example |
| --- | --- | --- |
| `bg-drive-in-card` token skin | 11 | Settings dialogs. |
| Transparent shell, inner card built by hand | 8 | `src/components/watched/review-modal.tsx:209`. |
| Raw hex skin | 3 | `bg-[#0a0a1e]` at `src/routes/app/profile.$userId.tsx:1219`, which equals the token. |
| Full-screen takeover | 3 | `src/components/achievements/achievement-popup.tsx:91`. |
| Bottom sheet | 1 | `src/components/shuffle/card-detail-modal.tsx:22`. |

Widths use 9 values, including `max-w-[340px]`, `[360px]`, and `[380px]`. The transparent shell family matters most. Each of the 8 rebuilds its own card, close control, and footer, which is where the core logging flows live.

`src/components/ui` is mostly unused. Only 10 of 56 primitives have an `app` importer, and `dialog` accounts for 24 of those imports. The design system in practice is one set of Tailwind strings repeated by hand, not a component library.

Orphaned product components: `Header`, `Footer`, `ThemeToggle`, `mode-pill`, `mode-switcher`, `hero-trailer`, `episode-card`, `season-row`, `tracker-reel-card`, `season-picker-modal`, `review-dialog`. They carry 108 raw colours that users never see, which is why they are out of the headline. `src/components/film-strip.tsx` (11 lines) and `src/components/watchlist/film-strip.tsx` (180 lines) share a name and export and do different things.

## Motion

Keyframes unused anywhere: `avatar-ring-rotate`, `button-underglow-pulse`, `screen-entrance`. Two exist as near twins, `grain` and `grain-profile`, and `bulb-chase` and `bulb-chase-profile`, because `src/routes/app/profile.$userId.tsx:86` carries its own `<style>` block.

| Measure | Value |
| --- | --- |
| Distinct CSS durations | 27, from 100ms to 25s, 174 hits |
| Distinct JS durations | 10, from 0.15s to 0.7s, 19 hits |
| `transition-*` utilities | 7 kinds, 288 hits, overridden on `a` and `button` by finding 1 |
| CSS easings | 6 |
| JS easings | `easeOut` 5, `[0.16, 1, 0.3, 1]` 4, `easeInOut` 2 |

Running animations, measured on `/app` routes with no motion preference:

| Route | Infinite animations running |
| --- | --- |
| `/app/search` | 104 |
| `/app/shuffle` | 169 |
| `/app/tracker` | 145 |
| `/app/watchlists` | 148 |
| `/app/profile` | 135 |
| `/app/title/movie/603` | 144 |

Each count includes one devtools animation that production lacks. Most are `twinkle` stars from `RetroOverlays`, which mounts on every `/app` page at `src/routes/app/route.tsx:75`. These run while a user reads or types. The performance cost belongs to the baselines report. The design question is whether a diary needs them behind its forms.

### Reduced-motion coverage

| Layer | Respects it? | Evidence |
| --- | --- | --- |
| CSS keyframes and transitions, including inline `animation*` styles | Yes | Global block at `src/styles.css:653`. Measured 0 running animations on all 6 routes under `reduce`, down from 104 to 169. |
| `motion` library, 11 files | ENTRANCE_ROW | No `useReducedMotion`, no `MotionConfig`. `motion` does not honour the preference by default. |
| `canvas-confetti`, 1 file | No | `src/components/tracker/completion-celebration.tsx:19` passes no `disableForReducedMotion`. Found by reading, not triggered in a run. |

Files with an unguarded JS animator: `achievement-grid`, `achievement-popup`, `marquee-board`, `recommend-modal`, `card-stack`, `match-celebration`, `swipe-card`, `ticket-stub`, `completion-celebration`, `friends`, `profile.$userId`, `settings/blocked`. The global block also leaves `animation-delay` alone, so a delayed entrance still waits.

## Theme

Where each element appears and what it seems to mean there. `file:line` lists are under `theme` in the JSON. Meanings are my reading of the code and screens, so treat them as judgement. Provenance notes come from `05-drive-in-reference.md`.

| Element | Where | What it means there |
| --- | --- | --- |
| Marquee with bulbs | `NowShowingHeader` on Feed, Friends, Tracker, Watchlists | Page heading. |
| | `NowShowingMarquee` on the title page | The current film. |
| | `MarqueeBadge` on login and onboarding | Status such as "Welcome Back", "Check Your Inbox", "Setting Up". |
| | `MarqueeBoard` on landing | Marketing feature list, "Tonight's Programme". |
| | `ShuffleMarquee` | Feature name, "NOW SHUFFLING / SHOWTIME SHUFFLE". |
| Ticket | `TicketStub` on landing, magic link emails, "Ticket Holder" achievement | Admission. |
| | Media type badge at `src/components/shuffle/swipe-card.tsx:328` | Category label. |
| Film strip | `FilmStripCard` at `src/routes/app/friends.tsx:89` | A person. |
| | `src/components/watchlist/film-strip.tsx` | A list of posters. |
| | `src/components/film-strip.tsx`, `FilmStripRow` in `cast-list` | A divider. |
| | Sprockets on the journal strip, `src/routes/app/tracker.index.tsx:606` | Texture. |
| Screen | `DriveInScreen` on the title page, header on tracker detail | Hero image and trailer. This one is apt. |
| Arcade button | `ArcadeButton` at `src/components/title/title-actions.tsx:333` | The three core diary actions. |
| | `.cta-push` on landing | Sign-up. |
| Car silhouettes | Title page, Feed | Decoration. Five fixed cars, unrelated to data. |
| Clapperboard | `ClapperboardStamp` on swipe | Yes or no verdict. |
| Curtains | `match-celebration`, `achievement-popup` | Reward moment. |
| Countdown leader | `CountdownLoader` on Shuffle | Loading, and a fixed intro. |
| Spotlights | Landing | Atmosphere. |
| Speaker post or box | `src/routes/app/tracker.$tmdbId.tsx:596`, `src/components/shuffle/shuffle-atmosphere.tsx:157` | Decoration, with no control attached. |
| Fog, stars, dust | Per-route `Atmosphere`, `ShuffleAtmosphere` | Night sky. |
| Grain, VHS scan | `RetroOverlays` on landing, auth, every `/app` page | Texture over all content. |
| Neon | Logo, nav, status, glow | Brand, and a stand-in for hierarchy. |
| Display case | `PosterDisplayCase`, "Feature Presentation" | Any title's poster. |
| Popcorn | Name, logo, emails | Brand. |

### Same element, conflicting meaning

- **"Now Showing"** claims a film is on, then labels Feed, which is not a film. At a real drive-in the marquee told passing drivers what was on tonight. Here it also fires for any title you open, watched or not.
- **Marquee** has five jobs: page title, film title, auth status, marketing list, and feature name.
- **"Curtain Call"** means a shuffle match with a friend at `src/components/shuffle/match-celebration.tsx:58`, and logging 1,000 watches at `src/lib/achievements.ts:176`.
- **Film strip** means a person, a list, a divider, and a texture. The reference found no source placing the motif on a real drive-in sign, ticket, or menu, because film stayed in the booth. That is a negative finding, not proof.
- **Countdown.** A real intermission clock told a lot how long remained until the next show. `CountdownLoader` counts to nothing, and the fixed timer runs even when data is ready.
- **Clapperboard** speaks the film set's language, "CUT!" and "TAKE 1", while the rest of the app speaks the audience's. The same swipe also returns random words, so "no" reads as NOPE, SKIP, NAH, or PASS from `src/components/shuffle/clapperboard-stamp.tsx:13`.
- **Arcade and VHS** have no drive-in provenance in the reference. VCRs appear there only as a cause of decline. This matters most for the arcade buttons, because they carry the three most important actions on the title page.

### Theme that slows a task

- Shuffle holds the first visit each session for 1.8 seconds at `src/routes/app/shuffle/index.tsx:36`, regardless of whether cards are ready.
- `AchievementPopup` is a full-screen modal requiring a Continue press, so it can interrupt logging.
- `MatchCelebration` auto-dismisses after 3 seconds at `src/components/shuffle/match-celebration.tsx:26`.
- Grain and scan lines sit over every form and every paragraph of synopsis.
- The arcade buttons have no accessible name, because the label is a sibling element. `verify-popcorn`'s own selector notes record this.
- Decorative tracking and 7px labels turn the tracker's main action into texture, per finding 3.

### Theme used consistently

Keep these in mind before changing anything.

- **Ticket means admission** across landing, the magic link email, and the onboarding achievement. This is the best example in the app of one element keeping one meaning.
- **Night sky** behind every `/app` page gives the app a recognisable place.
- **Type pairing** of `font-display` for titles and `font-mono-retro` for labels holds across 335 hits.
- **Amber bulbs and frames** always read as the marquee.
- **The drive-in screen on the title page** is the theme at its best, a real function doing a real job, showing the film.

## Light and dark

There is no real theme toggle. `ThemeToggle` is mounted only by `src/components/Header.tsx`, and no route imports `Header`. `next-themes` is installed, but no provider is mounted, so `useTheme()` at `src/components/ui/sonner.tsx:14` falls back to `system`. `THEME_INIT_SCRIPT` at `src/routes/__root.tsx:24` still sets `.light` or `.dark` from the OS.

The app is single-theme by construction. The tokens that carry the look (`cream`, `neon-*`, `drive-in-*`) are constants in `@theme`, and `.dark` does not touch them. They account for 1,827 class hits against 5 for theme-aware tokens. `dark:` appears 0 times in `app`.

A user whose OS is in light mode gets the dark app with some leaks, measured by running both schemes:

| Layer | Dark OS | Light OS | Effect |
| --- | --- | --- | --- |
| Page shell | `rgb(5,5,8)` | `rgb(5,5,8)` | None. |
| Nav and links | `rgb(141,229,219)`, 13.9:1 | `rgb(50,143,151)`, 5.3:1 | Dimmer, still readable. |
| Dialog body and close icon | `rgb(215,236,232)`, 15.9:1 | `rgb(23,58,64)`, 1.6:1 | The close icon nearly disappears. Text with an explicit colour class is fine. |
| Popover inherited text | `oklch(0.985 0 0)` | `oklch(0.141 0.005 285.823)` | Dark on a dark panel for any child that sets no colour. The watchlist popover's children all set their own, so I saw no visible failure there. |
| Toast | TOAST_DARK | TOAST_LIGHT | TOAST_EFFECT |
| Text below 3:1 | 2 elements in 8 routes | 2 elements in 8 routes | No new failures in page text. |

So the styling holds better in light mode than the code suggests, because almost everything hard-codes dark. The leaks are limited to inherited colour and shadcn tokens. Four inputs and one popover already patch around this with `[color-scheme:dark]` or a `dark` class, for example `src/components/watched/review-modal.tsx:298`. That patch is evidence the leak has already bitten someone. The product question for Gate 1 is whether Popcorn is a dark-only app. If it is, the OS switch should go, and the `.light` path with it.

## `src/styles.css` summary

99 tokens are defined. They come from three eras, stacked.

| Group | Tokens | State |
| --- | --- | --- |
| Sea template (`--sea-ink`, `--lagoon`, `--palm`, `--sand`, `--foam`, `--surface*`, `--line`, `--hero-*`, and others) | 19 | No live TSX use. Reached only through base rules for `body`, `a`, and `code`, and from orphaned `Header` and `Footer`. These are what paint the nav teal. |
| shadcn (`--background`, `--foreground`, `--primary`, `--sidebar*`, `--chart-*`, and others) | 64 with their `--color-*` aliases | Used by `ui` only. `app` has 5 class hits in total. |
| Drive-in (`--color-neon-*`, `--color-drive-in-*`, `--color-cream`, `--font-logo`, `--font-display`, `--font-mono-retro`) | 10 | The real system. 1,827 class hits. Constants, so they ignore `.dark`. |

Unused entirely, 17 tokens: `--palm`, `--destructive-foreground`, `--chart-1` to `--chart-5`, `--sidebar-primary`, `--sidebar-primary-foreground`, and their `--color-*` aliases.

CSS rules no live code uses: `.display-title`, `.island-shell`, `.feature-card`, `.rise-in`, `.site-footer`. `.island-kicker`, `.nav-link`, and `.page-wrap` serve orphans only, and `.episode-check-bounce` and `.episode-row-flash` serve the orphaned `season-row`.

Values that bypass tokens inside `styles.css`:

- `.cta-push` hard-codes `#1a1a2e`, which equals `--color-drive-in-border`, plus `#10101e`, `#0a0a14`, and `#22223a`.
- Keyframes restate the neon colours as `rgba(255,45,120,…)`, `rgba(0,229,255,…)`, and `rgba(255,184,0,…)`.
- `a:hover` hard-codes `#246f76`, and `.prose pre` hard-codes `#1d2e45`.
- `.scrollbar-amber` repeats `rgba(255,184,0,0.25)`.

Missing tokens are as telling as unused ones. No tokens exist for shadow or glow, type scale, letter spacing, z-index, motion duration, or easing, or for semantic roles such as danger, success, or primary. Those gaps match where the drift is worst.

## CI gates for later

Each gate is a budget that may only fall. Baselines come from `gates` in the JSON, so a gate can read that file directly.

| Measure | Baseline | Recommendation |
| --- | --- | --- |
| `unlayeredElementRules` | 6 | Gate first. It is the root cause of finding 1, and the target is 0. |
| `jsAnimatedFilesUnguarded` | 12 | Gate. Target 0. |
| `fontSizeHitsBelow10px` | 87 | Gate. Target 0. |
| `hardcodedTmdbUrls` | 7 | Gate. Target 0, and `getTmdbImageUrl` already exists. |
| `unusedKeyframes` | 3 | Gate. Target 0. |
| `orphanComponentsApp` | 11 | Gate. Target 0. |
| `customOverlaysApp` | 0 | Gate now, to protect the one thing that already holds. |
| `rawColourLiteralsApp` | 987 | Budget. Reduce by hand as tokens arrive. |
| `tailwindPaletteClassesApp` | 99 | Budget, once danger and success tokens exist. |
| `arbitraryFontSizesApp` | 13 | Budget. Target 0 after a type scale exists. |
| `distinctFontSizesApp` | 20 | Budget. |
| `arbitraryValuesApp` | 1,069 | Budget. Aim for a falling trend, not 0, because shadows and aspect ratios stay legitimate. |
| `inlineStylePropsApp` | 1,134 | Budget. |
| `distinctZIndexApp` | 11 | Budget, after a z-index scale exists. |
| `unusedTokens` | 17 | Report only. |

Do not gate on `rawButtonSignatures` (145), card signatures, or distinct colours. A harmless one-class edit moves them, so a gate would train people to ignore it.

The links-lose-their-colour result needs a browser, so it belongs in a `verify-popcorn` journey rather than the static gate. The static `unlayeredElementRules` gate catches the same cause without one.

## Limits of this report

- Class names built at runtime are not resolved. The scanner found none assembled by simple concatenation, and object-member lookups such as `neonTab.pink` go unread in signatures.
- Role matching uses names and class patterns, so a card-like div may not be a card. Counts are upper bounds. The direct grep checks above cover the extreme ones.
- Signatures ignore breakpoints and layout.
- Runtime probes used the dev server and seeded accounts with little data, so filled-state screens are under-sampled. Contrast skips text over gradients and images, so its count is a floor. Axe results in the baselines report are the better accessibility source.
- Infinite-animation counts are a single sample per route on a loaded machine. They are structural counts of mounted animations, not timings, so load does not change them.
- Theme meanings are my reading. Phase 2 should test them with the owner.
