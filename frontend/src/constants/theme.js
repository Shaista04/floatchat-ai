/**
 * Centralized Theme Configuration
 * Used across all components for consistent styling
 */

export const COLORS = {
  // Primary Theme
  primary: "#14b8a6", // Teal
  primaryDark: "#0d9488", // Dark Teal
  secondary: "#0284c7", // Blue
  secondaryLight: "#0ea5e9", // Light Blue

  // Backgrounds
  bgLight: "#f0fdfa", // Light Teal
  bgBlue: "#f0f9ff", // Light Blue
  bgWhite: "#ffffff", // White

  // Text
  textDark: "#0f172a", // Dark Slate
  textMuted: "#64748b", // Muted Slate
  textSecondary: "#475569", // Secondary Slate
  textLight: "#94a3b8", // Light Slate

  // Borders
  borderLight: "#e2e8f0", // Light Border
  borderTeal: "#ccfbf1", // Teal Border
  borderBlue: "#bae6fd", // Blue Border

  // Status
  success: "#10b981",
  error: "#ef4444",
  warning: "#f59e0b",
};

export const GRADIENTS = {
  primary: "linear-gradient(135deg, #14b8a6, #0284c7)",
  primaryToBlue: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
  blueToTeal: "linear-gradient(135deg, #0284c7, #0d9488)",
};

export const SHADOWS = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 25px rgba(20, 184, 166, 0.1)",
  xlTheme: "0 4px 15px rgba(20, 184, 166, 0.3)",
};

export const ANIMATIONS = {
  fadeIn: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.6, staggerChildren: 0.1 } },
  },
  fadeInUp: {
    hidden: { opacity: 0, y: 30 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", damping: 20, stiffness: 100 },
    },
  },
  staggerContainer: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  },
  staggerItem: {
    hidden: { opacity: 0, y: 30 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", damping: 20, stiffness: 100 },
    },
  },
};

export const BREAKPOINTS = {
  mobile: "640px",
  tablet: "768px",
  desktop: "1024px",
};
