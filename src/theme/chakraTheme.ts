// Chakra theme placeholder for responsive tokens
// We keep it framework-agnostic to avoid provider coupling.

export const breakpoints = {
  base: null,
  sm: "30em", // 480px
  md: "48em", // 768px
  lg: "62em", // 992px
  xl: "80em", // 1280px
};

// Export a light wrapper so consumers can import a single object if needed
const chakraTheme = {
  breakpoints,
} as const;

export default chakraTheme;
export type ChakraTheme = typeof chakraTheme;
