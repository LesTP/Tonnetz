export const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Create an SVG element with optional attributes.
 *
 * Uses `document.createElementNS` with the correct SVG namespace (RU-D14).
 */
export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
): SVGElementTagNameMap[K];
export function svgEl(
  tag: string,
  attrs?: Record<string, string | number>,
): SVGElement;
export function svgEl(
  tag: string,
  attrs?: Record<string, string | number>,
): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) setAttrs(el, attrs);
  return el;
}

/**
 * Set multiple attributes on an SVG (or any) element.
 */
export function setAttrs(
  el: Element,
  attrs: Record<string, string | number>,
): void {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
}
