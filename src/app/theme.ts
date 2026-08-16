import { createTheme, type MantineColorsTuple, rem } from '@mantine/core';

/**
 * The suite's theme: dense, dark, utilitarian (ADMIN_SUITE_DESIGN §4).
 *
 * Mist teal on deep blue-black — the game's own palette, so the cockpit reads as part of
 * Mistvale rather than a generic dashboard. No serif fonts anywhere (CLAUDE.md).
 */

/** Mist teal — the accent, at Mantine's ten required shades. */
const mist: MantineColorsTuple = [
  '#eafaf6',
  '#d5f2ea',
  '#abe6d7',
  '#7fd4c1', // 3 — the reference accent
  '#5cc4ae',
  '#43b89f',
  '#33b298',
  '#219c83',
  '#0f8b74',
  '#007862',
];

/** Deep blue-black — surfaces, borders and page background. */
const abyss: MantineColorsTuple = [
  '#c3c8d4',
  '#9aa1b3',
  '#727b91',
  '#525b71',
  '#3a4256',
  '#2a3143',
  '#1d2434',
  '#151b28',
  '#10141d',
  '#0b0e14', // 9 — the page background
];

const SANS =
  '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, "Noto Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", "SFMono-Regular", "Consolas", "Liberation Mono", monospace';

export const theme = createTheme({
  primaryColor: 'mist',
  primaryShade: { light: 6, dark: 4 },
  colors: { mist, abyss },
  fontFamily: SANS,
  fontFamilyMonospace: MONO,
  headings: { fontFamily: SANS, fontWeight: '600' },
  defaultRadius: 'sm',
  radius: { xs: rem(2), sm: rem(3), md: rem(4), lg: rem(6), xl: rem(8) },
  cursorType: 'pointer',
  autoContrast: true,
  components: {
    // A cockpit shows a lot at once; the default Mantine spacing is generous for it.
    Table: { defaultProps: { verticalSpacing: 'xs', horizontalSpacing: 'sm', fz: 'sm' } },
    Card: { defaultProps: { withBorder: true, padding: 'md' } },
    Paper: { defaultProps: { withBorder: true } },
    Badge: { defaultProps: { radius: 'sm' } },
    Modal: { defaultProps: { centered: true, overlayProps: { blur: 2 } } },
    TextInput: { defaultProps: { size: 'sm' } },
    NumberInput: { defaultProps: { size: 'sm' } },
    Select: { defaultProps: { size: 'sm', checkIconPosition: 'right' } },
    Textarea: { defaultProps: { size: 'sm' } },
  },
});

/** CSS variables the theme cannot express, applied globally in `global.css`. */
export const MIST_ACCENT = '#7fd4c1';
export const ABYSS_BG = '#0b0e14';
