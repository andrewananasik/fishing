/* Tabler Icons, MIT. Original SVGs and license: assets/icons/. */
const paths = {
  "x": "M18 6L6 18M6 6l12 12",
  "volume": "M15 8a5 5 0 0 1 0 8m2.7-11a9 9 0 0 1 0 14M6 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2l3.5-4.5A.8.8 0 0 1 11 5v14a.8.8 0 0 1-1.5.5z",
  "volume-off": "M15 8a5 5 0 0 1 1.912 4.934m-1.377 2.602A5 5 0 0 1 15 16m2.7-11a9 9 0 0 1 2.362 11.086m-1.676 2.299A9 9 0 0 1 17.7 19M9.069 5.054L9.5 4.5A.8.8 0 0 1 11 5v2m0 4v8a.8.8 0 0 1-1.5.5L6 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2l1.294-1.664M3 3l18 18",
  "swords": "M21 3v5l-11 9l-4 4l-3-3l4-4l9-11zM5 13l6 6m3.32-1.68L18 21l3-3l-3.365-3.365M10 5.5L8 3H3v5l3 2.5",
  "shield": "M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21A12 12 0 0 1 3.5 6A12 12 0 0 0 12 3",
  "rotate-clockwise": "M4.05 11a8 8 0 1 1 .5 4m-.5 5v-5h5"
} as const;

export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
