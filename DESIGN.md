---
name: Listening Lab
description: A calm listening notebook for focused practice
colors:
  background: "#f5f4ef"
  paper: "#fffefa"
  ink: "#263a32"
  muted: "#637069"
  accent: "#315f4b"
  line: "#d8dfd6"
  soft: "#e7ece3"
  error: "#9b3e2e"
  focus-action: "#b2803b"
  focus-field: "#64856e"
  selection: "#d6e4ba"
  accent-hover: "#234b39"
typography:
  display:
    fontFamily: '"DM Sans", "Noto Sans KR", sans-serif'
    fontSize: "clamp(2.5rem, 4.3vw, 3.6rem)"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"DM Sans", "Noto Sans KR", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: '"DM Sans", "Noto Sans KR", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.85
  label:
    fontFamily: '"DM Sans", "Noto Sans KR", sans-serif'
    fontSize: "12px"
    fontWeight: 500
rounded:
  field: "7px"
  control: "8px"
  transcript: "10px"
  reflection: "12px"
  surface: "14px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  xxxl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "15px 24px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-quiet:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 13px"
  setup-surface:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.surface}"
    padding: "36px"
---

# Design System: Listening Lab

## Overview

**Creative North Star: "A quiet listening notebook"**

Mode: Operate. The supplied minimal meditation-timer brief is the visual authority. Warm paper, evergreen ink, sage emphasis, ruled divisions and generous space keep attention on the current action. Korean guidance pairs with English training names.

**Key Characteristics:**
- Calm, focused pacing
- Paper surfaces and ruled divisions
- Clear native controls

## Colors

Evergreen carries action and active progress; warm neutrals carry reading and structure. Use the frontmatter palette as the source of truth.

### Primary
- **Evergreen:** primary actions, active steps, links and text carets; deepen on hover.

### Neutral
- **Warm background and paper:** page and writing surfaces.
- **Ink and muted ink:** primary and supporting text.
- **Line and soft sage:** divisions, completed steps and quiet hover surfaces.

Error uses warm rust. Action focus uses amber; field focus uses sage. Selection uses pale green. Status surfaces vary subtly within sage and warm beige rather than introducing a score palette.

## Typography

DM Sans and Noto Sans KR share the sans-serif stack; system fallback remains usable when hosted fonts cannot load. Display type is medium-weight with tight tracking. The setup display grows to about 58px; training titles use a smaller 30–43px range. Section headings are 20px. Most body copy is 13–14px; labels and supporting details are 10–12px. Transcript reading uses 17px type with a 2.1 line height, reducing to 15px on mobile. Timers and counts use tabular numerals.

## Layout

The main container is 1224px wide with 48px desktop side padding and 64px top spacing. The header reaches 1320px. Setup has two columns with generous separation; training uses a 220px step rail and a flexible content column, separated by 64px. Reflection and results center within 850px. Before and after align side by side.

At 1000px the grids tighten. At 720px setup and reflection stack, page padding becomes 22px, and the seven-step rail becomes seven numbered markers. Keep the official player fully visible with a minimum height of 220px. The spacing scale is a recurring rhythm, with component-specific values where implemented.

## Elevation & Depth

The interface uses no shadows. Paper surfaces, thin borders, ruled separators and subtle tonal differences supply depth. Preserve the quiet, flat reading surface.

## Shapes

Fields have gently curved corners; buttons are slightly rounder. Larger writing and result surfaces use progressively softer corners. Step markers and the recommendation symbol are circles. Native radio inputs remain visible.

## Components

Primary buttons use evergreen fill, paper text and a 48px minimum height. Quiet controls use thin ruled borders and soft hover backgrounds. Fields use paper fill, a thin sage-gray border and a 44px minimum height. Disabled controls fade to half opacity and use a disabled cursor. Action focus is a 3px amber outline offset by 4px; field focus is a 2px sage outline offset by 2px.

The active step is filled evergreen; completed markers use soft sage. The recommendation is one broad sage or warm-beige field with a literal level and reasons. It enters over 0.8 seconds with a 12px rise and brightness settling. Reduced-motion preference disables animation and transitions.

## Do's and Don'ts

- Do keep the current action visually clear.
- Do retain native form semantics and visible keyboard focus.
- Do stack comparison and form layouts on narrow screens.
- Don't introduce decorative shadows into the flat paper system.
- Don't replace literal level recommendations with a proficiency score.

## Contextual help refinement
The setup surface is now a single centered form (max-width 580px). Introductory slogans, sound-mark decoration and duplicate setup step list were removed at the user's request. Auxiliary instructions use a 16px CircleHelp glyph in a 36px target (44px for coarse pointers). Hover, keyboard focus and click/tap reveal a dark evergreen tooltip with 12px text; Escape, blur, a second tap or an outside press dismisses it. Portal positioning clamps to the viewport and follows scrolling, avoiding container clipping. Error messages, empty states, current task prompts and the short self-assessment disclaimer remain visible. This is progressive disclosure of existing guidance, not removal of functionality.

## Long-clip planning
Setup keeps its centered minimal form. For intervals over 40 seconds, a two-option native radio group selects whole-clip or two-session training. Each option shows its estimate; split mode lists both exact timestamp ranges and combined duration. The longer-than-one-hour notice is visible, while calculation details stay behind CircleHelp. A pending-part row above setup offers one resume action. Session and history labels identify part 1/2 or 2/2 without introducing an eighth training stage.

## Listening-focus refinement
Upper playback controls, 80–128px repeat numerals, and 36–56px time numerals lead repeat stages. The official player is last in normal document flow, never hidden or cropped, max-width 420px during repeats. Gap status sits above the figures with a 0/2/3/5s control below. The primary button becomes Next after ten repetitions. STEP 2 exposes a compact import action plus a help bubble; the official source and full-video coverage remain visible when imported. Final reflection and download surfaces were removed at user request. Existing colors, spacing and native controls remain authority.

Player location sign: a small downward-arrow label above the official player reads “아래에 YouTube 영상이 있습니다”, followed by 64px spacing. It provides wayfinding while keeping playback controls and the player unchanged.
