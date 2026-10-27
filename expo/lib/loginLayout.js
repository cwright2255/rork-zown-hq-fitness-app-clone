// lib/loginLayout.js
//
// Where things go on the login screen, worked out from the width of the phone.
//
// The top of the screen is white and the rest is black. The white meets the black along a straight
// line that rises to the right at DIAGONAL_ANGLE_DEG. The line always leaves the screen at the right-hand
// edge RIGHT_EDGE_Y down from the top, so a wider phone has a longer, lower left end, never a different angle.
//
// The black wordmark sits on the white, clear of the line. The tagline ("OWN THE / DAY") is white, so it
// sits on the black, clear of the line: white letters over the white part would not show.

export const DIAGONAL_ANGLE_DEG = 25;
export const RIGHT_EDGE_Y = 65; // where the white meets the black, at the right-hand edge, from the top of the screen

const TAN = Math.tan((DIAGONAL_ANGLE_DEG * Math.PI) / 180);

// assets/branding/zown-wordmark.png
const WORDMARK_ASPECT = 960 / 242;
const LOGO_WIDTH_RATIO = 0.42;
const LOGO_PREFERRED_TOP = 67; // below the Dynamic Island
const LOGO_GAP = 8; // clear space between the wordmark and the line

const TAGLINE_RIGHT = 20;
const TAGLINE_GAP = 6; // clear space between the line and the tagline
const TAGLINE_FONT_MAX = 44;
const TAGLINE_FONT_RATIO = 0.115;
const TAGLINE_LINE_RATIO = 1.2;
// "OWN THE" at the heaviest weight is about this many font sizes wide.
const TAGLINE_WIDTH_EM = 4.9;
const TAGLINE_LINES = 2;
const FORM_GAP = 12;

/** The y, from the top of the screen, of the line where the white meets the black, at x across a screen `width` wide. */
export function diagonalY(x, width) {
  return RIGHT_EDGE_Y + (width - x) * TAN;
}

/** Sizes and positions for a login screen `width` points wide. */
export function loginLayout(width) {
  const leftY = diagonalY(0, width);

  const logoWidth = Math.round(width * LOGO_WIDTH_RATIO);
  const logoHeight = Math.round(logoWidth / WORDMARK_ASPECT);
  const logoLeft = Math.round((width - logoWidth) / 2);
  // The line is lowest at the left, highest at the right: the right end of the wordmark is what has to clear it.
  const edgeAtLogoRight = diagonalY(logoLeft + logoWidth, width);
  const logoTop = Math.min(LOGO_PREFERRED_TOP, Math.floor(edgeAtLogoRight - LOGO_GAP - logoHeight));

  const taglineFont = Math.min(TAGLINE_FONT_MAX, Math.round(width * TAGLINE_FONT_RATIO));
  const taglineLine = Math.round(taglineFont * TAGLINE_LINE_RATIO);
  const taglineLeft = Math.max(0, width - TAGLINE_RIGHT - TAGLINE_WIDTH_EM * taglineFont);
  // The left end of the tagline is the part nearest the white.
  const taglineTop = Math.ceil(diagonalY(taglineLeft, width) + TAGLINE_GAP);
  const taglineBottom = taglineTop + TAGLINE_LINES * taglineLine;

  return {
    width,
    angle: DIAGONAL_ANGLE_DEG,
    rightY: RIGHT_EDGE_Y,
    leftY,
    // the white shape: top-left, top-right, then down the line to the left edge
    whitePoints: `0,0 ${width},0 ${width},${RIGHT_EDGE_Y} 0,${leftY}`,
    logo: { left: logoLeft, top: logoTop, width: logoWidth, height: logoHeight },
    tagline: { top: taglineTop, right: TAGLINE_RIGHT, fontSize: taglineFont, lineHeight: taglineLine, left: taglineLeft, bottom: taglineBottom },
    headerHeight: Math.ceil(Math.max(leftY, taglineBottom)) + FORM_GAP,
  };
}
