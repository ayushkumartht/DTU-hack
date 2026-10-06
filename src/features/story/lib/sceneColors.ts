// A distinct accent per scene, used only as a thin underline/dot — never a
// fill — so a story segment and its matching scene card visually pair up
// without introducing colored boxes into the otherwise neutral Arc palette.
export const SCENE_COLORS: string[] = [
  "#C97C1C", // amber
  "#4C7A3B", // sage
  "#2E6B94", // sky
  "#A6463F", // rose
];

export function sceneColor(index: number): string {
  return SCENE_COLORS[index % SCENE_COLORS.length];
}
