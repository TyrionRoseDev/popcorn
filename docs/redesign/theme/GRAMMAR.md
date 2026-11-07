# Theme grammar

This page says what each drive-in element means in Popcorn, where it may appear, and where it must not. Every rule comes from the job the real artefact did, as recorded in `docs/redesign/phase-1/05-drive-in-reference.md`. Section numbers below point at that file. The objects are the ones in `docs/redesign/decisions/README.md`: title, entry, diary, progress, watching, want to watch, list, friend and feed.

Phase 1 found the theme applied by shape, not by meaning (`docs/redesign/phase-1/05-design-drift.md`, Theme). "Now Showing" labelled a film and the Feed page. A film strip meant a person, a list, a divider and a texture. This grammar gives each element one meaning and at most two homes.

## Three rules that sit above the table

1. **The lot is dark. The road is bright.** Drive-ins aimed neon and bright signs at the road and the entrance. Inside, lights had to be shaded and the tower floods went off during the show, because light on the screen ruined the picture (section 8). So brightness and glow belong where Popcorn invites someone in: the landing page, sign-in, empty states and celebrations. Anywhere a user reads, types or decides, the page stays dark and quiet.
2. **An element appears only where its meaning is true.** If the sentence "this is the marquee, so it tells you what is on" is false for a spot, the marquee does not go there. Shape alone never earns a place.
3. **Controls are never themed.** The one control a patron touched was a plain volume knob on a grey speaker (section 2, and "Arcade" under Misconceptions). Buttons, inputs, tabs and menus use the plain patterns in `TOKENS.md`. They keep the same size, colour and place on every screen.

## Elements

| Element | What it means in Popcorn | May appear | Must not appear | Real artefact and its job |
| --- | --- | --- | --- | --- |
| Marquee letter board, with bulbs | What is on. It names a title, never a page. | 1. Title page header, carrying the title's name and year. 2. Diary "Up next" board, carrying the one or two shows you are part way through. | Page headings such as Friends, Lists, Watching or Settings. Auth status ("Welcome back"). Feature names. Loading screens. | The board told passing drivers what was on tonight, changed with the programme, and the Beverly's board had two slots for the double bill (section 1). |
| Screen | The title's own picture, its backdrop and trailer. | 1. Title page hero. 2. Show page hero for a show in progress. | Cards, list rows, dialogs, profile headers, decorative frames. | The tower held the picture up for the whole lot (section 9). It is the one element Phase 1 found already apt. |
| Ticket stub with a serial number | One entry, with its number in your diary sequence. "No. 128" is your 128th entry. | 1. The entry number as plain small text on a diary row and on the title page's "Your entries". 2. The landing page and the sign-in email, where it means admission. | Category badges, media type labels, achievements, buttons. A full ticket shape on every row of a list. | The booth issued numbered stubs so the count could be audited and a gap showed up (section 4). Ticket already means admission across landing, email and onboarding, the one element Phase 1 found consistent. |
| Bulbs, lit | Something worth announcing. | 1. The marquee frame, static. 2. A celebration banner after a task ends, where the bulbs may chase once. | Page dividers, nav, form borders, loading states. Chasing or blinking while a user reads or types. | Bulbs framed the board and the Caro's flashing border lights sold the show to the road (sections 1 and 8). |
| Neon glow | An invitation to come in. | 1. The logo, landing page and sign-in. 2. Empty states, to invite the next step, and celebration headings. | Nav text, list rows, form labels, body copy, status colours, errors. | Neon faced the road and the entrance. Lights inside the lot had to be shaded (section 8). |
| Night sky | Where you are, outdoors after dark. | 1. Page background behind the header area, static. 2. Landing and sign-in. | Behind body text, forms or dialogs. Animated stars while a user works. | Not an artefact. It is the setting every source describes, and Phase 1 found it gives the app "a recognisable place". Keep it, still and faint. |
| Cars in the lot | Friends who have an entry for this title. One car per friend. | Title page only, inside or near "Friends who watched", and only when at least one friend has an entry. | Decoration with no data, such as the five fixed cars on the Feed and title pages today. | Two cars fit between posts and the lot held the audience (sections 2 and 3). A car with no person behind it means nothing. |
| Row sign, with "Full" | Where you are in a series, and when a set is complete. | 1. Watching: "S2 E5" as the next row, and "Full" when a season is done. 2. A completed list. | Page headings, date headings in the feed or diary. | Lit row-end signs showed the row number and "Full" so patrons could find their car and see a full row (section 3). |
| Intermission clock | Time until a real next event. | 1. Watching, for the next episode's release ("airs in 6 days"). 2. Nowhere else. | Loading indicators. A fixed intro timer such as the 1.8 second Shuffle countdown. | The clock told a lot how long remained until the next feature (section 5). A clock counting to nothing breaks that. |
| Changeover | The next thing is ready before you need it. | 1. Diary "Up next", with "Watched E5" one tap away. 2. Finishing an episode cues the next. | Not a visual element. Never a transition animation. | The booth ran two projectors so the picture never stopped (section 7). |
| Speaker post | The one control you change during a watch sits right at the thing it controls. | Not a visual element. It is the rule that progress controls sit on the show row, not in a menu. | Drawn speakers or posts as decoration, as at `tracker.$tmdbId.tsx:596` today. | The patron hung the speaker on the window and set the volume there (section 2). |
| Concession line | Logging is one pass with every choice in view and one commit at the end. | Not a visual element. It is the rule for the Add entry sheet. Date, rating, note, visibility and "watched with" in one sheet, one Save. | Stacked dialogs, such as "Watched with" opening on top of the review dialog today. | The cafeteria line put every item in view and had one cashier at the end (section 6). |
| Call light | Help and suggestions wait until asked. | Not a visual element. Notifications show a count on the bell. Nothing pops over a task. | Popups that arrive mid-task, such as the achievement popup over Show Complete. | Patrons lit a signal when they wanted service, so car hops stopped disturbing people (section 11). |
| Screen instructions | Tell the user once, on the surface they are looking at, when it applies. | Inline hints in empty states and first-run moments. | Persistent banners, repeated tips, help text over a form. | Trailers told patrons what to do at the moment it applied (section 12). |

## Elements to retire

No source in the reference supports these on a drive-in, or the source contradicts them. They go, whatever the direction.

| Element | Where it is today | Why it goes |
| --- | --- | --- |
| Film strip and sprockets | Friends cards, list strips, cast dividers, the journal | Film stayed in the booth. No sign, ticket or menu used it (Misconceptions, "Film strips"). It carries four meanings today. |
| Arcade buttons | The three main title page actions | No drive-in source mentions arcades. The control patrons touched was a volume knob (Misconceptions, "Arcade"). They also have no accessible name. |
| VHS scan lines and grain | `RetroOverlays` over every page | VCRs appear in the sources as a cause of the decline (Misconceptions, "VHS"). Grain sits over every form. |
| Clapperboard | Shuffle verdict stamp | It speaks the film set's language. Popcorn speaks the audience's. |
| Curtains | Match and achievement moments | Indoor theatres had curtains. Drive-ins had a screen tower. |
| Fog, dust, twinkling stars, spotlights | Per-route atmospheres, landing | No artefact behind them, and 104 to 169 infinite animations run per page today. Keep one still sky. |
| "Now Showing" as a heading | Feed, Watchlists, Tracker, Friends | The marquee names a title, not a page. |
| Countdown leader as a loader | Shuffle | A countdown must count to a real event. |

## Where the theme gets out of the way

These surfaces use the plain patterns in `TOKENS.md` and no drive-in element at all, in both directions.

- **Forms.** The Add entry sheet, edit entry, sign-in fields, settings dialogs, report and block flows. A user is typing or deciding.
- **Lists.** Diary rows, Want to watch, lists, search results, friends. Rows are the same height, the same type and the same controls on every screen.
- **The diary itself.** Entries are text and posters. The only theme in a row is the entry number, as data.
- **Settings and account.** No marquee, no glow, no sky.
- **Navigation.** The five tabs are plain text, the same weight and size. The active tab is the text colour plus an amber underline. Tab colour carries no meaning.
- **Any control a user needs often.** Add entry, Watched E5, Want to watch, Edit, Save, Cancel, Accept. They are at least 44 px tall, labelled in words, and never smaller than 14 px text.
- **Errors and loading.** An error says what failed and offers Retry. Loading is a skeleton in the shape of the content. Neither is themed, so they never look like a celebration or a decoration.

## Colour meaning

Each colour has one job. The current app repeats pink, cyan and amber in nav order, so colour carries no meaning (`05-design-drift.md`, item 5).

| Colour | Means | Never means |
| --- | --- | --- |
| Amber | Your action and your rating: the primary button, the active tab line, stars, progress. Also the marquee bulbs. | Errors, decoration on rows. |
| Cyan | Keyboard focus. | Status, links, tabs, "watched". |
| Pink neon | The brand, on the logo, landing, sign-in, empty states and celebrations. | Errors, Want to watch, destructive actions. |
| Red | Danger and errors only. | Brand, emphasis. |
| Green | Success only, in toasts and confirmations. | Status of a show. |

## How the two directions apply this grammar

Both directions follow every rule above. They differ in how much of each allowed home the theme fills.

| Element | Restrained | Literal |
| --- | --- | --- |
| Marquee on the title page | Dark board, amber hairline, static bulbs, title in display type. | Lit cream letter board with black letters, a red second line, bulb frame and posts. |
| Marquee on Diary "Up next" | Same dark board, as a small card. | Lit letter board above the two next-episode rows. |
| Entry number | Not shown in the mock. Recommended as plain small text. | A ticket stub on every diary, title and feed entry, with number and date on the stub. |
| Screen | Backdrop with a soft fade. | White screen face, tower legs and a lot below it. |
| Cars | Not shown. Friends are a plain list. | One car per friend in front of the screen, with their rating. |
| Feed date headings | Plain bold text. | Lit row signs. |
| Sky and header | Flat dark. | Still stars and a bulb strip under the header. |
| Empty state | Pink outline icon, plain heading. | Neon heading, "The lot is empty tonight". |
| Celebration | Plain banner with an amber icon. | Banner inside a bulb frame. |

The mock-ups and measurements are in `RECOMMENDATION.md`.
