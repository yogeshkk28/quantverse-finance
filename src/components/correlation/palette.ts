import * as d3 from "d3";

/**
 * Data colours for the Correlation Web, stepped for the Event Horizon dark surface.
 *
 * Event Horizon reserves gold for actions, violet for atmosphere and green/red
 * for price direction, so groups use the validated dark categorical steps for
 * blue, orange, aqua, yellow and magenta, in that fixed order. Past five groups
 * the colour folds to muted grey, and every group also gets its own marker
 * shape, so identity never rests on colour alone.
 */
export const GROUP_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
export const GROUP_OVERFLOW = "#a3a7b7";
export const groupColor = (i: number) => GROUP_COLORS[i] ?? GROUP_OVERFLOW;

export const GROUP_SHAPES = [d3.symbolCircle, d3.symbolSquare, d3.symbolDiamond, d3.symbolTriangle, d3.symbolWye, d3.symbolStar, d3.symbolCross];
export const groupShape = (i: number) => GROUP_SHAPES[i % GROUP_SHAPES.length];
export const shapePath = (i: number, area: number) => d3.symbol(groupShape(i), area)() ?? "";

/** Diverging scale for correlations: blue (−1) through a neutral grey (0) to orange (+1). */
export const NEG = "#3987e5";
export const POS = "#d95926";
export const MID = "#2a2e3c";
export const divergingColor = (v: number) => {
  const x = Math.max(-1, Math.min(1, v));
  return x >= 0 ? d3.interpolateLab(MID, POS)(Math.sqrt(x)) : d3.interpolateLab(MID, NEG)(Math.sqrt(-x));
};

/** Neutral ink for edges and chart chrome, from the theme's text tokens. */
export const INK = {
  text: "#f3efe6",
  text2: "#c9cbd6",
  muted: "#a3a7b7",
  line: "#232634",
  line2: "#2f3344",
  gold: "#d4af37",
  goldSoft: "#f5e6ca",
  surface: "#10121a",
  surface2: "#161924",
};

export const ROLE_LABEL: Record<string, string> = {
  core: "Core hub",
  bridge: "Bridge",
  periphery: "Periphery",
  mid: "Mid-network",
};
