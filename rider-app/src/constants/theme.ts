// Shinitz Premium Theme - Green & Gold Palette
// Inspired by Zomato/Swiggy modern design language

export const COLORS = {
  // Primary Green
  primary: '#0F3D2E',
  primaryDark: '#0a2d20',
  primaryLight: '#1a6b4a',

  // Gold Accent
  accent: '#D4AF37',
  accentDark: '#b8952e',
  accentLight: '#e8cb6a',

  // Success/Green
  success: '#10b981',
  successDark: '#059669',
  successLight: '#34d399',

  // Backgrounds - Light & Airy
  background: '#f8f9fa',
  surface: '#ffffff',
  surfaceLight: '#f0f2f5',
  card: '#ffffff',

  // Text
  text: '#1a1a2e',
  textSecondary: '#5a6178',
  textMuted: '#9ca3af',

  // Utility
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  border: '#e8ecf0',
  borderLight: '#f0f2f5',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Tab Bar
  tabBar: '#ffffff',
  tabBarBorder: '#e8ecf0',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONTS = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  },
  families: {
    heading: 'Poppins_700Bold',
    headingSemiBold: 'Poppins_600SemiBold',
    body: 'Inter_400Regular',
    bodySemiBold: 'Inter_600SemiBold',
  },
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const ORDER_STATUS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  delivery_assigned: 'Delivery Assigned',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Labels used by StatusBadge / order screens
export const ORDER_STATUS_LABELS: Record<string, string> = ORDER_STATUS;

// Color used by StatusBadge for each status (background + dot + text use this)
export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: COLORS.warning,
  accepted: COLORS.info,
  preparing: COLORS.info,
  ready_for_pickup: COLORS.accent,
  delivery_assigned: COLORS.accent,
  out_for_delivery: COLORS.primary,
  delivered: COLORS.success,
  cancelled: COLORS.error,
};
