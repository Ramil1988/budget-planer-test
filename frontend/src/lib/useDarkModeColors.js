import { useColorModeValue } from '../components/ui/color-mode';

/**
 * Custom hook providing consistent dark mode colors across all pages
 * Returns an object with semantic color values that automatically adapt to light/dark mode
 */
export function useDarkModeColors() {
  return {
    // Backgrounds
    pageBg: useColorModeValue('#FAFAF9', '#09090B'),
    cardBg: useColorModeValue('white', '#18181B'),
    cardHoverBg: useColorModeValue('#FAFAFA', '#27272A'),
    inputBg: useColorModeValue('white', '#18181B'),
    modalBg: useColorModeValue('white', '#18181B'),
    tooltipBg: useColorModeValue('#18181B', '#FAFAFA'),

    // Text colors
    textPrimary: useColorModeValue('#18181B', '#FAFAFA'),
    textSecondary: useColorModeValue('#52525B', '#D4D4D8'),
    textMuted: useColorModeValue('#71717A', '#A1A1AA'),
    textInverse: useColorModeValue('#FAFAFA', '#18181B'),

    // Borders
    borderColor: useColorModeValue('#E4E4E7', '#3F3F46'),
    borderSubtle: useColorModeValue('#F4F4F5', '#3F3F46'),
    borderStrong: useColorModeValue('#D4D4D8', '#52525B'),

    // Interactive colors (links, buttons, etc.)
    primary: useColorModeValue('#2563EB', '#60A5FA'),
    primaryHover: useColorModeValue('#1D4ED8', '#3B82F6'),
    primaryBg: useColorModeValue('#EFF6FF', 'rgba(59, 130, 246, 0.15)'),
    primaryBgHover: useColorModeValue('#DBEAFE', 'rgba(59, 130, 246, 0.25)'),

    // Status colors (income/expense)
    success: useColorModeValue('#16A34A', '#4ADE80'),
    successBg: useColorModeValue('#DCFCE7', 'rgba(74, 222, 128, 0.15)'),
    successBorder: useColorModeValue('#86EFAC', 'rgba(74, 222, 128, 0.3)'),
    danger: useColorModeValue('#DC2626', '#F87171'),
    dangerBg: useColorModeValue('#FEE2E2', 'rgba(248, 113, 113, 0.15)'),
    dangerBorder: useColorModeValue('#FCA5A5', 'rgba(248, 113, 113, 0.3)'),
    warning: useColorModeValue('#CA8A04', '#FACC15'),
    warningBg: useColorModeValue('#FEF9C3', 'rgba(250, 204, 21, 0.15)'),
    warningBorder: useColorModeValue('#FDE047', 'rgba(250, 204, 21, 0.3)'),
    info: useColorModeValue('#2563EB', '#60A5FA'),
    infoBg: useColorModeValue('#DBEAFE', 'rgba(59, 130, 246, 0.15)'),
    infoBorder: useColorModeValue('#93C5FD', 'rgba(59, 130, 246, 0.3)'),

    // Table/List row colors
    rowHoverBg: useColorModeValue('#F4F4F5', '#27272A'),
    rowStripedBg: useColorModeValue('#FAFAFA', '#1C1C1E'),
    rowNormalBg: useColorModeValue('#F9FAFB', '#1F1F23'),

    // Payment/List item backgrounds (for urgency states)
    itemDueTodayBg: useColorModeValue('#FEF2F2', 'rgba(239, 68, 68, 0.15)'),
    itemDueTodayBorder: useColorModeValue('#FECACA', 'rgba(239, 68, 68, 0.3)'),
    itemDueSoonBg: useColorModeValue('#FFFBEB', 'rgba(234, 179, 8, 0.15)'),
    itemDueSoonBorder: useColorModeValue('#FDE68A', 'rgba(234, 179, 8, 0.3)'),

    // Icon/Badge backgrounds (for expense/income indicators)
    expenseIconBg: useColorModeValue('#FEE2E2', 'rgba(239, 68, 68, 0.2)'),
    incomeIconBg: useColorModeValue('#D1FAE5', 'rgba(16, 185, 129, 0.2)'),

    // Toggle button colors
    toggleActiveBg: useColorModeValue('white', '#27272A'),
    toggleInactiveBg: useColorModeValue('transparent', 'transparent'),
    toggleActiveText: useColorModeValue('#18181B', '#FAFAFA'),
    toggleInactiveText: useColorModeValue('#71717A', '#A1A1AA'),
    toggleHoverBg: useColorModeValue('#E4E4E7', '#3F3F46'),

    // Skeleton/Loading states
    skeletonStart: useColorModeValue('#E4E4E7', '#27272A'),
    skeletonEnd: useColorModeValue('#F4F4F5', '#3F3F46'),

    // Shadows
    cardShadow: useColorModeValue(
      '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)'
    ),
    cardHoverShadow: useColorModeValue(
      '0 4px 12px rgba(0,0,0,0.1)',
      '0 4px 12px rgba(0,0,0,0.4)'
    ),
  };
}

export default useDarkModeColors;
