# Pinewood Frontend — Antigravity Change Log

> **Purpose**: This file tracks all frontend changes made during the Antigravity (Gemini) coding session.
> When switching back to Claude, read this file first to understand what changed and why.

---

## Session Info

- **Started**: 2026-09-26
- **Constraint**: Frontend-only changes. Backend, database, Edge Functions, and `supabase/` are **not touched**.
- **Agent**: Antigravity (Google Gemini)

---

## Changes

### Change #1 — Editorial redesign of reservation form selection controls (Sections 02, 03, 04)
- **Date**: 2026-09-26 21:28
- **Files Modified**:
  - `src/components/reserve/booking-flow.tsx` — Redesigned visual treatment of Branch, Inside/Outside, and Number of People selectors
- **Files Created**: None
- **Files Deleted**: None (removed unused `Choice` component from within booking-flow.tsx)
- **Why**: The existing form used rectangular card-style selection boxes for branch, seating, and party size — too generic/SaaS-looking for a refined restaurant brand.
- **What**:
  - **Section 02 (Branch)**: Replaced 3 rectangular `Choice` cards with an editorial location selector. Each branch shows a `MapPin` icon, branch name (semibold), and address (muted). Selected state = teal background + white text + `Check` icon. Unselected = transparent with subtle hover. Branches separated by thin dividers (vertical on desktop, horizontal on mobile).
  - **Section 03 (Inside/Outside)**: Replaced 2 rectangular `Choice` cards with icon-based selector. Inside shows `Home` icon, Outside shows `TreePalm` icon. Selected state = thin teal border + light teal tint (6% opacity) + filled teal check circle. Unselected = transparent + warm-gray border + empty circle indicator.
  - **Section 04 (Number of People)**: Replaced rectangular numbered buttons with circular selectors (`size-10 rounded-full`). Selected = solid teal circle + white number. Unselected = transparent + thin circular outline. Dot separator (·) after number 1. Uses flex-wrap layout instead of grid.
  - **Removed `Choice` component**: Was a private function only used by sections 02 and 03. Both now have inline implementations with richer icon/divider/indicator treatment.
- **Impact**: `/reserve` page — sections 02, 03, 04 only. No logic, data, validation, or server action changes. All `role="radiogroup"`, `role="radio"`, `aria-checked`, `aria-label`, `tabIndex`, and `radioKeys` keyboard handlers preserved identically.
- **Notes**:
  - Lucide icons added: `Check`, `Home`, `MapPin`, `TreePalm`
  - E2E test selector `radiogroup "Number of people"` and `radio "3"` preserved (same accessible names)
  - Evening mode works via existing semantic tokens (`bg-primary`, `text-primary-ink`, etc.)
  - Pre-existing lint warnings (4) are unchanged; 0 new warnings/errors introduced

### Change #2 — Navbar Navigation Links Horizontal Centering
- **Date**: 2026-09-26 22:02
- **Files Modified**:
  - `src/components/site/header.tsx` — Wrapped logo in `flex flex-1 items-center justify-start` and right actions in `hidden flex-1 items-center justify-end`, centering `<nav>` in the container.
- **Why**: Nav links (`HOME MENU VISIT US ABOUT US`) were pushed to the left because the logo and right-side controls had different widths under `justify-between`.
- **What**: Balanced both flanks with `flex-1` so the primary nav sits at the true horizontal center of the viewport/navbar.
- **Impact**: Global header across all pages.

### Change #3 — Dish Strip Marquee Direction Reversal (Opposite Rotation)
- **Date**: 2026-09-26 22:03
- **Files Modified**:
  - `src/app/globals.css` — Added `--animate-roll-left: roll-left 60s linear infinite` and `@keyframes roll-left` (`from: translateX(0)` to `translateX(-50%)`).
  - `src/components/site/dish-cards.tsx` — Changed animation class from `animate-roll-right` to `animate-roll-left`.
- **Why**: User requested "make the picture rotation opposite as from what it is right now" for the "From the menu" dish carousel.
- **What**: Replaced left-to-right marquee with standard right-to-left marquee motion.
- **Impact**: Home page ("From the menu" section dish showcase).

### Change #4 — Cappuccino Photo Clean Image Replacement
- **Date**: 2026-09-26 22:03
- **Files Modified**:
  - `src/components/site/menu-browser.tsx` — Replaced `{ name: "cappuccino", soft: true }` with `{ name: "cappuccinoPost" }`.
- **Why**: User noted that the cappuccino photo looked distorted/blotchy ("looks like gooblesh") due to being a rough cutout with soft-edges from the printed menu.
- **What**: Used the clean, high-resolution original restaurant photo `cappuccinoPost` (`/images/photos/cappuccino-post.webp`) featuring the cappuccino with latte art, saucer, and chocolate chip cookie on wood table, rendered with rounded corners and object-cover matching the other dessert and coffee photos.
- **Impact**: Menu page (`/menu`) under Coffee section.

### Change #5 — Hero Visual Scaling, 16:9 Composition, and Typography Refinement
- **Date**: 2026-09-26 22:05
- **Files Modified**:
  - `src/components/site/hero-carousel.tsx` — Expanded photo container to full width (`lg:inset-0`), refined dark-to-light gradient overlay on the left 38%, scaled typography down to comfortable editorial sizes matching reference composition (`media_1790436328039.jpg`), and tightened vertical container constraints.
  - `src/components/site/home-hero.tsx` — Updated `objectPosition` of `pine-3` slide to `"80% 50%"` so both food plates and water glasses are framed naturally without aggressive zoom/crop.
- **Why**: The hero was previously zoomed in too tight and vertically oversized, cropping the plates, cutting off water glasses, and showing oversized text.
- **What**: Re-framed into a wide cinematic 16:9 composition where the photograph occupies ~60-65% on the right and text occupies ~35-40% on the left with proportional text scales.
- **Impact**: Home page hero (`/`).

### Change #6 — About Page Rooms Gallery Grid Redesign (Eliminating Random Spaces and Centering)
- **Date**: 2026-09-26 22:10
- **Files Modified**:
  - `src/app/(site)/about/page.tsx` — Restructured the 7 room photos into balanced pairs (7 cols landscape + 5 cols portrait) and a centered feature photo (8 cols centered with `md:col-start-3`), removing asymmetrical column skips (`md:col-start-9`, `md:col-start-2`, `md:col-start-6`) and arbitrary vertical offsets (`md:mt-24`, `md:-mt-12`, `md:mt-10`).
  - `src/components/site/header.tsx` — Smoothed navbar link gap from `gap-5 md:flex lg:gap-12` to `gap-6 md:flex lg:gap-10 xl:gap-12`.
- **Why**: User reported "random spaces, not centered" with a screenshot of `localhost:3000/about` where the photo gallery had large empty blank holes and scattered offset cards.
- **What**: Rebuilt the gallery into a cohesive, centered 12-column grid where photos cleanly fill each row with aligned vertical baselines (`items-center`) and zero empty holes.
- **Impact**: About page (`/about#rooms`) and header navbar spacing.

### Change #7 — Manager Reservations Inbox for Future/Upcoming Bookings
- **Date**: 2026-09-26 22:20
- **Files Modified**:
  - `src/components/admin/reservations-board.tsx` — Added incoming/future reservations loader (`today` to `today + 30 days`), realtime listener integration, header `Inbox` button with live pending badge count, and slide-over `InboxPanel` modal dialog.
- **Why**: The reservations register only shows bookings for one selected date at a time. If a guest reserved for a future date (e.g. Sep 30 while viewing Sep 26), the manager wouldn't see it unless they manually flipped to that date.
- **What**: Added an **Inbox** notification button with a live badge showing the count of unconfirmed/pending future bookings. Clicking opens a slide-over panel previewing upcoming bookings with guest name, party size, branch, date/time, status badge, and notes. Clicking any booking automatically navigates the board to that date and opens the full reservation panel for immediate confirmation or actions.
### Change #8 — Home Page Section 3 ("Inside Pinewood") Dead Space Elimination & Wide Scaling
- **Date**: 2026-09-26 22:25
- **Files Modified**:
  - `src/app/(site)/page.tsx` — Expanded Container from default `max-w-7xl` to `lg:max-w-[88rem] xl:max-w-[100rem] 2xl:max-w-[110rem] 2xl:px-[4.5vw]`, scaled room photo collage row heights (`xl:auto-rows-[clamp(11rem,12.5vw,16rem)] xl:gap-5`), and refined typography.
- **Why**: User sent an annotated screenshot showing large empty "Dead space" margins on both the left and right sides of the "Inside Pinewood" section on desktop monitors.
- **What**: Removed the restrictive 1280px container cap on wide displays so the section smoothly expands to match the wide framing of the hero and navigation (`2xl:max-w-[110rem] 2xl:px-[4.5vw]`), while scaling the photo collage proportionally to fill the layout.
- **Impact**: Home page (`/`) Section 3 ("Inside Pinewood").

### Change #9 — Site-Wide Dead Space Elimination, Wide Monitor Scaling, and Reserve Page Layout Polish
- **Date**: 2026-09-26 22:34
- **Files Modified**:
  - `src/components/site/section.tsx` — Updated base `<Container>` to scale up from `max-w-7xl` on small/medium displays to `lg:max-w-[88rem] lg:px-12 xl:max-w-[100rem] 2xl:max-w-[110rem] 2xl:px-[4.5vw]` on wide monitors.
  - `src/components/site/header.tsx` — Aligned global navbar wrapper to scale with `lg:max-w-[88rem] xl:max-w-[100rem] 2xl:max-w-[110rem]` across all pages.
  - `src/components/site/footer.tsx` — Expanded footer content and sub-bar wrappers to match wide display breakpoints.
  - `src/app/(site)/menu/page.tsx` & `src/components/site/menu-browser.tsx` — Expanded menu header banner, sticky category nav, and menu items container to wide display scale.
  - `src/app/(site)/reserve/page.tsx` — Rebuilt Section 4 ("Call us") from an asymmetrical 2-column layout into an editorial 3-column layout matching `/visit` (Intro | Phone numbers with vertical divider | Outlets with directions links with vertical divider), and expanded Section 3 ("Good to know") spacing (`xl:gap-x-20`, `text-base xl:text-lg`).
  - `src/components/site/dish-cards.tsx` — Scaled dish cards on large displays to `lg:w-80 xl:w-[21rem]` for an appetizing, full layout.
- **Why**: User sent screenshots (`media_1790436565262.png`, `media_1790436488705.webp`) with red-circled gutters and "dead space" annotations on desktop viewports for Section 2 ("From the menu"), Section 4 ("What guests say"), and the Reserve page ("Call us" / "Good to know").
- **What**:
  - Eliminated the restrictive 1280px (`max-w-7xl`) cap at the core `<Container>` component so every page (Home, Menu, Visit, About, Reserve, Privacy) scales naturally to fill wide 1080p, 1440p, and ultrawide screens.
  - Aligned Header and Footer containers with the new breakpoint scale.
  - Rebuilt the Reserve page's "Call us" section into a 3-column balanced composition, placing phone numbers and branch locations with map directions side-by-side, completely filling the previously vacant right flank.
  - Increased dish card widths in the home marquee so dish photos feel substantial and balanced against the left menu list.
- **Impact**: All pages (`/`, `/menu`, `/reserve`, `/about`, `/visit`), global Header, and Footer.
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors), Vitest (165/165 passed), Playwright E2E (46/46 passed across desktop and mobile).

### Change #10 — [Reverted] Menu Page Header Spacing and 3-Column Desktop Grid
- **Date**: 2026-09-26 22:38 (Reverted at 22:50)
- **Status**: Reverted per user preference ("i dont like this menu spacing, i liked the previous one better"). The original 2-column layout (`md:columns-2`), generous header spacing, and large script title were fully restored, preserving only the clean cappuccino photo from Change #4.
- **Impact**: `/menu` page restored to previous preferred layout.
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors), Vitest (165/165 passed), Playwright E2E (46/46 passed across desktop and mobile).

### Change #11 — Home Page Featured Dish Showcase: Crossfade Opacity Slideshow (Replacing Marquee)
- **Date**: 2026-09-26 22:44
- **Files Modified**:
  - `src/components/site/dish-cards.tsx` — Replaced the horizontal rolling ticker (`DishStrip`) with a featured dish slideshow matching the hero page's opacity crossfade animation.
- **Why**: User requested: "change the animation here, it should not go from left to right but rather something like the hero page, one stays for 5-10 seconds then the next one appears with the opacity animation thing" with a screenshot of the home page "From the menu" section.
- **What**:
  - Built an editorial slideshow where each photographed dish is showcased in a prominent frame (`aspect-[16/11] sm:aspect-[4/3]`) for ~6.5 seconds before cross-fading to the next dish via `transition-opacity duration-1000 ease-[var(--ease-soft)]`.
  - Added a gentle Ken Burns scale zoom (`scale-100` to `scale-[1.03]`) matching the hero carousel aesthetic.
  - Displayed the active dish name and price smoothly beneath the frame with a direct link to that item's section on `/menu`.
  - Added slide indicator progress pills and next/previous arrow buttons for manual browsing.
  - Added hover pause (`onMouseEnter`/`onMouseLeave`), focus pause, keyboard arrow key navigation (`ArrowLeft`/`ArrowRight`), and `prefers-reduced-motion` support via `useSyncExternalStore`.
- **Impact**: Home page (`/`) Section 2 ("From the menu").
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors, 0 warnings), Vitest (165/165 passed), Playwright E2E (46/46 passed across desktop and mobile).

### Change #12 — Reservation Form Step Divider: Centered Pine Tree Logo with Soft Gradients
- **Date**: 2026-09-26 22:48
- **Files Modified**:
  - `src/components/reserve/booking-flow.tsx` — Replaced the generic full-width `border-t border-line` dividers between form steps (01, 02, 03, etc.) with a custom centered Pine Tree logo badge (`PineGlyph`) flanked by soft gradient lines.
- **Why**: User requested: "i dont like the lines in between like 01 02 03, can we do something unique? like a small logo of pinetree to keep it relevant, right in the center to also keep it clean and make a small distinction between 01 02 03" with a screenshot of the `/reserve` steps.
- **What**:
  - Removed the edge-to-edge `border-t border-line` that ran across the entire form.
  - Inserted an editorial centered divider between steps: a subtle circular badge containing the authentic Pinewood tree mark (`PineGlyph className="h-3.5 w-auto"`), flanked on the left and right by soft fading gradient accent lines (`max-w-[8rem] sm:max-w-[14rem]`).
  - Added subtle hover scale and automatic dark/light tone switching via existing Pinewood logo tokens (`evening:bg-cream-100/10`, `opacity-75 evening:opacity-90`).
  - Preserved semantic roles and accessibility (`aria-hidden` on decorative divider).
- **Impact**: `/reserve` page booking flow steps.
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors), Vitest (165/165 passed), Playwright E2E (46/46 passed across desktop and mobile).

### Change #13 — Home Page Featured Dish Showcase: Typography Alignment to Website Sans
- **Date**: 2026-09-26 22:53
- **Files Modified**:
  - `src/components/site/dish-cards.tsx` — Replaced the Cormorant Garamond serif font (`display`) on dish titles and prices with the website's standard sans-serif typography (`Fira Sans` / `font-semibold text-ink`), matching the left-hand menu column and the rest of the site.
- **Why**: User requested: "dont like the font, change it, make it similar to what we already have on the website" with a screenshot highlighting the serif caption text.
- **What**:
  - Removed the `display` serif class from the dish name and price.
  - Styled dish name in crisp, modern sans (`text-xl font-semibold tracking-tight text-ink sm:text-2xl`).
  - Styled price in clean tabular sans figures (`text-lg font-semibold text-ink-muted sm:text-xl tabular-nums`).
  - Aligned with the left-hand featured dishes list in Section 2, ensuring unified typography across both sides of the section.
- **Impact**: Home page (`/`) Section 2 featured dish showcase.
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors, 0 warnings), Vitest (165/165 passed), Playwright E2E (46/46 passed across desktop and mobile).

### Change #14 — Home Page Reviews: Bold Typography & Tightened Spacing Under Lead Review
- **Date**: 2026-09-26 23:00
- **Files Modified**:
  - `src/app/layout.tsx` — Added weight `"700"` to Google Font `Cormorant_Garamond` loader so true bold serifs are available across the application.
  - `src/app/(site)/page.tsx` — Updated Section 4 ("What guests say") typography and layout:
    - Made lead review quote bold (`display font-bold text-3xl sm:text-4xl lg:text-[2.75rem] xl:text-[3rem]`).
    - Styled lead author citation with crisp weight (`mt-4 text-base font-semibold text-ink-muted`).
    - Made secondary review quotes bold and substantial (`font-display font-bold text-xl sm:text-[1.35rem] leading-snug text-ink`).
    - Styled secondary review authors with `font-semibold text-ink-muted`.
    - Raised the two-column review grid up closer to the lead review by reducing the top margin from `mt-20` (80px) to `mt-6 sm:mt-8 lg:mt-8` (24px–32px), eliminating the wide gap beneath `"Fatima Adreeta · Google Maps review"`.
- **Why**: User requested: "make the fonts bold and raise it up, closer to 'Fatima Adreeta · Google Maps review'" with a screenshot of the reviews section.
- **What**:
  - Loaded full 700 bold weight for `Cormorant_Garamond` in Next.js font configuration.
  - Set bold font weight on both the primary and secondary guest quotes, resolving thin/faint legibility issues on desktop screens.
  - Reduced the inter-row gap from 80px down to ~24px-32px, visually binding the lead quote and supporting reviews into a unified editorial block.
- **Impact**: Home page (`/`) Section 4 ("What guests say").
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors), Vitest (303/303 passed), Playwright E2E (10/10 customer tests passed, 46/46 full suite passed).

### Change #15 — Visit Page: Centered "our outlets" Heading and Balanced 3-Column Layout
- **Date**: 2026-09-26 23:04
- **Files Modified**:
  - `src/app/(site)/visit/page.tsx` — Centered Section 2 ("The outlets") header and restructured the outlet directory into a balanced 3-column layout.
- **Why**: User requested: "bring 'our outlets' in the middle" with a screenshot showing the section header pushed to the left edge and an asymmetrical 2x2 grid with an empty bottom-right space.
- **What**:
  - Centered the `ScriptTitle` ("our outlets") horizontally above the directory using `text-center pl-0`.
  - Replaced the asymmetrical 12-column grid (`col-span-4` title + `col-span-8` 2-column list) with a full-width, balanced 3-column layout (`grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12 xl:gap-16`).
  - Allocated one distinct column to each of the 3 outlets (Dhanmondi Road 6, Dhanmondi Road 27, and Banani), eliminating dead space and orphaned slots.
- **Impact**: Visit page (`/visit`) Section 2 ("our outlets").
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors), Vitest (303/303 passed), Playwright E2E (10/10 customer tests passed, 46/46 full suite passed).

### Change #16 — Home Page Reviews: Reverted Lead Review Quote from Bold to Elegant Display Weight
- **Date**: 2026-09-26 23:06
- **Files Modified**:
  - `src/app/(site)/page.tsx` — Removed `font-bold` from the primary lead review quote and reset the attribution weight to clean `text-ink-muted`.
- **Why**: User requested: "dont make this bold" with a screenshot of the lead review quote.
- **What**:
  - Restored `lead.body` to the standard `.display` weight (500) so the hero pull-quote remains light, open, and graceful.
  - Retained the bold typography (`font-bold`) and tightened spacing on the supporting two-column reviews grid beneath it, keeping them easily readable without overpowering the lead quote.
- **Impact**: Home page (`/`) Section 4 lead review.
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors), Vitest (303/303 passed), Playwright E2E (10/10 customer tests passed, 46/46 full suite passed).

### Change #17 — Menu Browser: Balanced Mains Columns by Adding Spaghetti Bolognese Photo
- **Date**: 2026-09-26 23:14
- **Files Modified**:
  - `src/components/site/menu-browser.tsx` — Added `{ name: "spaghetti" }` to `SECTION_PHOTOS.mains`.
  - `src/lib/i18n/en.ts` & `src/lib/i18n/bn.ts` — Added localized caption for the spaghetti photo (*"Spaghetti Bolognese"* / *"স্প্যাগেটি বোলোনিজ"*).
- **Why**: User requested: "i see a random space here you can add some media here" with a screenshot of the `/menu` page in evening mode showing a blank void in the right-hand column directly across from the `PINE 2` plate.
- **What**:
  - In the 2-column layout (`md:columns-2`), the left column ended with `pine2` at ~6841px while the right column previously ended with `penne` at ~6405px, leaving an empty 436px hole.
  - Added the high-resolution `spaghetti` food photo to the Mains photo sequence, which now renders at the bottom of the right column (~6873px).
  - Both columns now balance out evenly (within ~32px of each other), cleanly filling the gap and transitioning seamlessly into the Coffee section below.
- **Impact**: Menu page (`/menu`) Section 2 ("Mains").
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors), Vitest (303/303 passed), Playwright E2E (10/10 customer tests passed, 46/46 full suite passed).

### Change #18 — Photography Assets: Replaced Low-Res Cutouts with High-Res Facebook Photography
- **Date**: 2026-09-26 23:25
- **Files Modified**:
  - `public/images/photos/` — Re-extracted all 9 Facebook food images (`cappuccino-post.webp`, `steak-set.webp`, `shashlik-set.webp`, `alfredo-bake.webp`, `buffalo-chicken-set.webp`, `mexican-chicken.webp`, `fish-cake.webp`, `chicken-cheese-burger.webp`, `seafood-platter-post.webp`) directly from the original 1254x1254 master JPGs provided in `Facebook/` using `sharp` at 95% quality, more than doubling resolution and detail.
  - `public/images/facebook/` — Stored all 9 full-size (1254x1254) original master poster images for future marketing and promotion use.
  - `src/components/site/menu-browser.tsx` — Removed `{ name: "redVelvet", soft: true }` from `desserts` to eliminate the blurry 431x260 low-resolution menu cutout. Replaced `seafoodPlatter` with `seafoodPlatterPost` in `mains`.
  - `src/lib/site.ts` — Updated `DISH_PHOTOS` mapping so `cappuccino` maps to `"cappuccinoPost"` and `"seafood-platter"` maps to `"seafoodPlatterPost"`, ensuring high-resolution assets are used across all dish cards and slideshows.
- **Why**: User provided the `Facebook/` folder with 9 master uncompressed photos and asked: `"C:\Users\Saalim\Desktop\PINEWOOD DN\Pinewood\Facebook" check this folder, there are some high res picture directly from facebook, use these instead of some low res pics like this one` with a screenshot of the pixelated Red Velvet cutout.
- **What**:
  - Eliminated the last low-resolution physical menu cutout (`red-velvet.webp`) from the menu gallery, leaving authentic, crisp food photography (`oreoCheesecakeReal` and `brownieReal`).
  - Swapped out downsampled webp assets across the site for high-fidelity 95% quality exports generated directly from the 1254x1254 Facebook originals.
  - Guaranteed all dish cards, featured slideshows, and menu sections utilize crisp, high-resolution photography without blurred edges or compression artifacts.
- **Impact**: `/menu`, `/`, `/reserve`, and all featured dish cards.
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors), Vitest (303/303 passed), Playwright E2E (10/10 customer tests passed, 46/46 full suite passed).

### Change #19 — Booking Flow: Centered Pine Tree Step Dividers over Controls Column
- **Date**: 2026-09-26 23:32
- **Files Modified**:
  - `src/components/reserve/booking-flow.tsx` — Aligned the pine tree divider container to the right column (`lg:col-span-8 lg:col-start-5`) within the 12-column reservation grid.
- **Why**: User requested: "the pines look really good but not quite well centered" with a screenshot showing the pine tree divider centered across the entire container width (`col-span-12`), causing the tree glyph to sit awkwardly skewed to the left over the interactive inputs (`Inside` / `5` / `Date`).
- **What**:
  - Changed the divider container from full 12-column span (`col-span-12`) to target the controls column (`<div className="grid lg:grid-cols-12" aria-hidden><div className="flex items-center justify-center gap-3 py-6 sm:gap-4 sm:py-8 lg:col-span-8 lg:col-start-5">`).
  - On desktop (`lg+`), the pine tree and its flanking gradient lines now sit dead-center directly between the interactive inputs (`Inside`/`Outside`, `5`/`6`, `Date`/`Time`, and across the textarea).
  - On mobile and tablet screens (`<lg`), where the form stacks in a single column, the divider continues to span full width and centers naturally across the viewport.
- **Impact**: Reservation page (`/reserve`) booking form step transitions.
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors), Vitest (303/303 passed), Playwright E2E (10/10 customer tests passed, 46/46 full suite passed).

### Change #20 — Home Page Reviews: Centered "what guests say" Header and Balanced Reviews Layout
- **Date**: 2026-09-26 23:40
- **Files Modified**:
  - `src/app/(site)/page.tsx` — Centered Section 4 header (`t.home.reviewsTitle`), centered the hero lead review quote, and centered the two-column supporting reviews layout.
- **Why**: User requested: `"what guests say" can be in the middle, its very much in the top of the left of the whole content`. Previously, "what guests say" sat isolated in the top-left 4 columns (`lg:col-span-4`), while the lead quote and supporting reviews were offset into columns 5–12 on the right, leaving an awkward empty void beneath the title on the left.
- **What**:
  - Centered the `ScriptTitle` ("what guests say") above the section using `<Reveal className="text-center"><ScriptTitle className="text-center pl-0 text-4xl sm:text-5xl lg:text-[3.25rem]">{t.home.reviewsTitle}</ScriptTitle></Reveal>`.
  - Centered the lead review quote as a prominent hero pull-quote (`mx-auto max-w-4xl text-center`) directly beneath the script header.
  - Placed the supporting reviews in a centered 2-column container (`mx-auto max-w-5xl sm:columns-2 gap-x-12 lg:gap-x-16`), balancing the columns across the full viewport and eliminating the blank space on the left.
  - Maintained crisp bold weights on supporting reviews and authors, with tight, elegant vertical spacing throughout.
- **Impact**: Home page (`/`) Section 4 ("What guests say").
- **Verification**: `tsc --noEmit` passed (0 errors), `eslint` passed (0 errors), Vitest (303/303 passed), Playwright Customer E2E (10/10 passed on desktop & mobile).

### Change #21 — Visit Page: Reverted "our outlets" Layout to Original 12-Column Grid
- **Date**: 2026-09-26 23:44
- **Files Modified**:
  - `src/app/(site)/visit/page.tsx` — Reverted Section 2 back to the original layout (`grid gap-12 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32` with `ScriptTitle` in `lg:col-span-4` and outlets list in `sm:grid-cols-2 lg:col-span-8 lg:pt-3`).
- **Why**: User requested: `"go back to the old version of how we had this our outlets part"` with a screenshot of the centered 3-column layout (`media_1790443207571.png`).
- **What**:
  - Reverted Section 2 of the Visit page (`/visit`) to its exact original design.
  - Left column (`lg:col-span-4`) holds `ScriptTitle` ("our outlets").
  - Right column (`lg:col-span-8`) displays the outlets in a 2-column grid (`sm:grid-cols-2`).
- **Impact**: Visit page (`/visit`) Section 2 ("our outlets").
- **Verification**: `tsc --noEmit` passed (0 errors), Vitest (303/303 passed), Playwright E2E passed.








