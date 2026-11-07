# Theme recommendation

## The short answer

Go with **restrained**. It keeps the parts of the drive-in look you said you liked, the big screen and the lit marquee on the title page, and gives every other page a calm, fast layout. It also takes one idea from the literal version. Each diary entry shows its number, like a numbered ticket stub.

## What I compared

I built three screens in the running app, each in two versions behind one switch. The screens are the new Diary home, the Title page and the Friends feed. Both versions follow the same rules in `GRAMMAR.md`. They differ in how much of the page the theme fills.

- **Restrained.** The theme lives in page headers, empty states and celebrations. Lists, forms and buttons are plain.
- **Literal.** The theme frames more of the page. The marquee is a lit letter board. Every entry is a ticket stub. Friends who saw a film are parked as cars in front of the screen. Date headings are lit row signs. Stars sit in the sky.

All posters and photos are real TMDB images. The data is made up. The mock-ups are throwaway pages at `/app/mock/diary`, `/app/mock/title` and `/app/mock/feed`, with `?d=restrained` or `?d=literal`. They will not be merged.

## The screenshots

Each image is the whole page at a phone width (390 px) and a laptop width (1440 px), captured by `docs/redesign/theme/tools/capture-mockups.ts`. The black strip at the top is the mock-up switch, not part of the design.

| Screen | Restrained | Literal | Today |
| --- | --- | --- | --- |
| Diary, phone | [diary-restrained@390](mockups/diary-restrained@390.png) | [diary-literal@390](mockups/diary-literal@390.png) | No diary screen exists |
| Diary, laptop | [diary-restrained@1440](mockups/diary-restrained@1440.png) | [diary-literal@1440](mockups/diary-literal@1440.png) | No diary screen exists |
| Title, phone | [title-restrained@390](mockups/title-restrained@390.png) | [title-literal@390](mockups/title-literal@390.png) | [current-title@390](mockups/current-title@390.png) |
| Title, laptop | [title-restrained@1440](mockups/title-restrained@1440.png) | [title-literal@1440](mockups/title-literal@1440.png) | [current-title@1440](mockups/current-title@1440.png) |
| Friends feed, phone | [feed-restrained@390](mockups/feed-restrained@390.png) | [feed-literal@390](mockups/feed-literal@390.png) | [current-feed@390](mockups/current-feed@390.png) |
| Friends feed, laptop | [feed-restrained@1440](mockups/feed-restrained@1440.png) | [feed-literal@1440](mockups/feed-literal@1440.png) | [current-feed@1440](mockups/current-feed@1440.png) |
| Empty feed, phone | [feed-empty-restrained@390](mockups/feed-empty-restrained@390.png) | [feed-empty-literal@390](mockups/feed-empty-literal@390.png) | |
| Empty feed, laptop | [feed-empty-restrained@1440](mockups/feed-empty-restrained@1440.png) | [feed-empty-literal@1440](mockups/feed-empty-literal@1440.png) | |

The "Today" images come from the current app on a test copy with a few entries added. The current title page is 426 px wide on a 390 px phone, which is the sideways overflow Phase 1 found.

## Why restrained

I measured both versions in the browser at the same sizes, with `docs/redesign/theme/tools/measure-mockups.ts`. The positions include the mock-up switch, which is about 100 px tall on a phone and 43 px on a laptop, read from the screenshots.

| What I measured | Restrained | Literal |
| --- | --- | --- |
| Where "Add to diary" ends on the title page, phone | 580 px down | 894 px down |
| Where "Add to diary" ends on the title page, laptop | 836 px down | 1081 px down |
| Length of the diary page, phone | 2322 px | 2833 px, 22% longer |
| Narrowest note text in the diary, phone | 190 px wide | 136 px wide |
| Narrowest note text on the title page, phone | 229 px wide | 123 px wide |
| Text smaller than 12 px, any screen | 0 | 0 |

Three things decide it.

1. **The main button stays on screen.** A common phone screen is 844 px tall. On the restrained title page, "Add to diary" is in view when the page opens. On the literal page, the cars and the bigger board push it below the bottom edge, so you scroll before you can log a film. On a laptop the same thing happens: 836 px fits in the window, 1081 px does not. Today the round Watched button sits about 1080 px down on a phone, under the poster, read from the screenshot.
2. **Your notes stay readable.** The ticket stub takes 76 px from every row. On a phone that leaves notes about 136 px wide, two or three words a line, and the diary gets 22% longer for the same entries.
3. **It is harder to get wrong again.** Phase 1 found the old theme spread because each new page copied a shape. Restrained has fewer themed pieces, and each has one home. Literal needs five more pieces (stub, letter board, cars, row signs, bulb strip), and each is another thing someone could put in the wrong place.

Literal is not wrong. It follows the same rules, and on a laptop it is the more fun of the two. If you want more theme than restrained, the piece I would add first is the lit letter board on the title page alone. I have not measured that combination yet.

## What you would notice

- The title page keeps its big screen and the bulb-framed marquee. The marquee shows just the film's name, year, length, rating and director. "Now Showing" goes, because the film is not showing. You are reading about it.
- The three round buttons become labelled buttons: a yellow "Add to diary", then "Want to watch" and "Recommend". They sit above the poster, so they are on screen when the page opens.
- The new Diary home has an "Up next" board inside a bulb frame, with the shows you are part way through and a one-tap "Watched E5" button. It is the marquee's second and last home, because it really is what is on next for you.
- The feed loses the "NOW SHOWING / FEED" marquee and the row of cars. It becomes a list of your friends' entries with posters, sorted by when they watched, with no achievements mixed in.
- The night sky stays, still and dark. The twinkling stars, grain and scan lines go. Today 104 to 169 animations run on every page.
- Colours mean one thing each. Yellow is your action and your rating. Pink neon is the brand, empty pages and celebrations. Red is only for errors and deleting. Cyan is only the outline that shows where the keyboard is.
- Badges show as a small banner after you finish what you were doing, never on top of it.
- Every piece of text passes the contrast check, with the faintest at 5.26:1. Nothing on screen is smaller than 12 px, and buttons use 14 px.

## What it costs

Both directions need the same groundwork first: the tokens in `TOKENS.md`, one set of buttons, cards, inputs, tabs, rows, and empty, loading and error states, and removing the old overlays. That is most of the work in Wave 4 either way.

Restrained then needs two themed pieces: the marquee board and the celebration banner. Literal needs those two plus the stub, the lit letter board, the cars, the row signs and the bulb strip. Each extra piece has to be built, tested at phone width, checked for contrast and kept in its one place.

Restrained also costs some charm on everyday screens. The diary and feed look like a well-made app with a drive-in sign over the door, not like a drive-in. I think that is the right trade for screens you open every day, and the title page, landing page, empty pages and celebrations still feel like the drive-in.

## Not decided

- **The cars.** I like them as a picture of which friends saw a film. They cost the button its place on a phone. They could come back lower on the title page, inside "Friends who watched". I have not mocked that.
- **The entry number.** I recommend showing "No. 128" on diary rows, but restrained as mocked does not show it yet. It needs one decision, whether numbers stay fixed when someone deletes an entry. A gap is honest, like a missing stub, but some people may read it as a bug.
- **A light theme.** I have assumed Popcorn is dark only, since nobody can reach the light theme today. If you want one, the tokens need a second set of values and a second contrast check.
