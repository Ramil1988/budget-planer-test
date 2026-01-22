import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  VStack,
  HStack,
  Text,
  Spinner,
  Input,
  Button,
  SimpleGrid,
  Textarea,
  Portal,
  CloseButton,
} from '@chakra-ui/react';
import { Dialog } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';
import { useDarkModeColors } from '../lib/useDarkModeColors';

/**
 * AssetsLiabilities - Comprehensive net worth tracker
 *
 * Features:
 * - Track assets by category (Real Estate, Cash, Investments, etc.)
 * - Track liabilities (Mortgages, Loans, Credit Cards, etc.)
 * - Calculate net worth and key metrics
 * - Financial Health Score (0-100)
 * - Asset allocation donut chart
 * - Net worth trend line chart
 * - Debt payoff projections
 * - Emergency fund indicator
 * - Net worth goal tracking
 * - Historical snapshots for trend analysis
 */

// Default asset categories with icons and colors
const defaultAssetCategories = [
  { name: 'Real Estate', icon: '🏠', color: '#6366F1' },
  { name: 'Cash', icon: '💵', color: '#10B981' },
  { name: 'Savings Account', icon: '🏦', color: '#3B82F6' },
  { name: 'RRSP', icon: '📊', color: '#8B5CF6' },
  { name: 'TFSA', icon: '💼', color: '#14B8A6' },
  { name: 'Vehicle', icon: '🚗', color: '#F59E0B' },
  { name: 'Investment', icon: '📈', color: '#EC4899' },
  { name: 'Other Assets', icon: '💎', color: '#9CA3AF' },
];

// Default liability types with icons
const defaultLiabilityTypes = [
  { name: 'Mortgage', icon: '🏡' },
  { name: 'Car Loan', icon: '🚙' },
  { name: 'Student Loan', icon: '🎓' },
  { name: 'Credit Card', icon: '💳' },
  { name: 'Personal Loan', icon: '💰' },
  { name: 'Line of Credit', icon: '📝' },
  { name: 'Other Liability', icon: '💸' },
];

// Asset category colors for charts
const assetCategoryColors = {
  'Real Estate': '#6366F1',
  'Cash': '#10B981',
  'Savings Account': '#3B82F6',
  'RRSP': '#8B5CF6',
  'TFSA': '#14B8A6',
  'Vehicle': '#F59E0B',
  'Investment': '#EC4899',
  'Other Assets': '#9CA3AF',
  'default': '#94A3B8',
};

const getCategoryColor = (name) => assetCategoryColors[name] || assetCategoryColors.default;

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

// Format number with space separators for input display (e.g., 320000 -> "320 000")
const formatNumberWithSpaces = (value) => {
  if (value === '' || value === 0) return '';
  const numStr = String(value).replace(/\s/g, '');
  const parts = numStr.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join('.');
};

// Parse number from formatted string (e.g., "320 000" -> 320000)
const parseFormattedNumber = (value) => {
  return value.replace(/\s/g, '');
};

// Convert recurring payment amount to monthly equivalent based on frequency
const convertToMonthly = (amount, frequency) => {
  const multipliers = {
    daily: 365 / 12,
    weekly: 52 / 12,
    biweekly: 26 / 12,
    'semi-monthly': 2,
    monthly: 1,
    quarterly: 1 / 3,
    'semi-annually': 1 / 6,
    annually: 1 / 12,
  };
  const multiplier = multipliers[frequency] || 1;
  return parseFloat(amount) * multiplier;
};

// Format percentage
const formatPercent = (value) => {
  return `${(value || 0).toFixed(1)}%`;
};

// ============================================
// CHART COMPONENTS
// ============================================

// Asset Allocation Donut Chart
const AssetAllocationChart = ({ assets, categories, totalAssets, hoveredCategory, onHoverCategory, colors, groupedData }) => {
  const size = 200;
  const strokeWidth = 35;
  const hoverExpand = 8;
  const padding = hoverExpand;
  const svgSize = size + padding * 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const center = svgSize / 2;

  // Use groupedData if provided (with "Other Assets" grouping), otherwise calculate from assets
  let data;
  if (groupedData) {
    data = groupedData;
  } else {
    // Fallback: Aggregate assets by category
    const categoryTotals = {};
    assets.forEach((asset) => {
      const cat = categories.find((c) => c.id === asset.category_id);
      const catName = cat?.name || 'Other';
      categoryTotals[catName] = (categoryTotals[catName] || 0) + parseFloat(asset.amount || 0);
    });

    // Convert to array and sort by amount
    data = Object.entries(categoryTotals)
      .map(([name, amount]) => ({ name, amount, percent: totalAssets > 0 ? (amount / totalAssets) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }

  // Calculate segments for the chart (filter out tiny segments that cause visual artifacts)
  let currentOffset = 0;
  const segments = data
    .filter((item) => {
      const percent = item.percent || (totalAssets > 0 ? (item.amount / totalAssets) * 100 : 0);
      return percent >= 0.5; // Skip segments smaller than 0.5% to avoid visual artifacts
    })
    .map((item) => {
      const percent = item.percent || (totalAssets > 0 ? (item.amount / totalAssets) * 100 : 0);
      const segmentLength = (percent / 100) * circumference;
      const segment = {
        ...item,
        percent,
        offset: currentOffset,
        length: segmentLength,
        color: getCategoryColor(item.name),
      };
      currentOffset += segmentLength;
      return segment;
    });

  const hoveredSegment = hoveredCategory ? segments.find((s) => s.name === hoveredCategory) : null;

  if (data.length === 0) {
    return (
      <Box position="relative" w={svgSize} h={svgSize}>
        <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
        </svg>
        <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" textAlign="center">
          <Text fontSize="sm" color={colors.textMuted}>No assets</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box position="relative" w={svgSize} h={svgSize}>
      <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#F4F4F5" strokeWidth={strokeWidth} />
        {segments.map((segment, index) => {
          const isHovered = hoveredCategory === segment.name;
          const isOtherHovered = hoveredCategory && !isHovered;
          return (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={isHovered ? strokeWidth + hoverExpand : strokeWidth}
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
              style={{ transition: 'all 0.2s ease', opacity: isOtherHovered ? 0.3 : 1, cursor: 'pointer' }}
              onMouseEnter={() => onHoverCategory(segment.name)}
              onMouseLeave={() => onHoverCategory(null)}
            />
          );
        })}
      </svg>
      <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" textAlign="center" pointerEvents="none">
        {hoveredSegment ? (
          <>
            <Text fontSize="10px" color={hoveredSegment.color} fontWeight="600" mb={0.5} noOfLines={1} maxW="90px">
              {hoveredSegment.name}
            </Text>
            <Text fontSize="lg" fontWeight="800" color={colors.textPrimary} letterSpacing="-0.02em">
              {formatCurrency(hoveredSegment.amount)}
            </Text>
            <Text fontSize="10px" color={colors.textMuted} fontWeight="600">
              {hoveredSegment.percent.toFixed(1)}%
            </Text>
          </>
        ) : (
          <>
            <Text fontSize="xs" color={colors.textMuted} fontWeight="500" mb={0.5}>Total Assets</Text>
            <Text fontSize="xl" fontWeight="800" color={colors.textPrimary} letterSpacing="-0.02em">
              {formatCurrency(totalAssets)}
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
};

// Net Worth Trend Line Chart
const NetWorthTrendChart = ({ snapshots, colors }) => {
  if (!snapshots || snapshots.length === 0) {
    return (
      <Box h="200px" bg={colors.rowStripedBg} borderRadius="12px" display="flex" alignItems="center" justifyContent="center">
        <VStack gap={2}>
          <Text fontSize="3xl">📊</Text>
          <Text color={colors.textMuted} fontSize="md">Save snapshots to see your net worth trend</Text>
          <Text color={colors.textSecondary} fontSize="sm">Click "Save Snapshot" to record your first data point</Text>
        </VStack>
      </Box>
    );
  }

  // Sort snapshots by date (oldest first for chart)
  const sortedSnapshots = [...snapshots].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

  const values = sortedSnapshots.map((s) => s.equity);
  const maxVal = Math.max(...values.map(Math.abs), 1);
  const minVal = Math.min(...values, 0);

  const width = 700;
  const height = 200;
  const paddingTop = 30;
  const paddingBottom = 40;
  const paddingLeft = 60;
  const paddingRight = 20;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate Y scale
  const yRange = maxVal - minVal || 1;
  const getY = (val) => paddingTop + chartHeight - ((val - minVal) / yRange) * chartHeight;

  // Generate points
  const points = sortedSnapshots.map((s, i) => {
    const x = paddingLeft + (sortedSnapshots.length > 1 ? (i / (sortedSnapshots.length - 1)) * chartWidth : chartWidth / 2);
    const y = getY(s.equity);
    return { x, y, equity: s.equity, date: s.record_date, assets: s.total_assets, liabilities: s.total_liabilities };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = points.length > 0 ? `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${paddingLeft} ${height - paddingBottom} Z` : '';

  // Y-axis labels
  const yLabels = [
    { value: maxVal, y: paddingTop },
    { value: (maxVal + minVal) / 2, y: paddingTop + chartHeight / 2 },
    { value: minVal, y: paddingTop + chartHeight },
  ];

  const formatShort = (val) => {
    if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val.toFixed(0)}`;
  };

  const [hoveredPoint, setHoveredPoint] = useState(null);

  return (
    <Box overflowX={{ base: 'auto', md: 'visible' }} position="relative">
      <Box minW={{ base: '600px', md: 'auto' }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxWidth: '100%' }}>
          {/* Grid lines */}
          {yLabels.map((label, i) => (
            <g key={i}>
              <line x1={paddingLeft} y1={label.y} x2={width - paddingRight} y2={label.y} stroke="#E5E7EB" strokeWidth={1} strokeDasharray="4,4" />
              <text x={paddingLeft - 10} y={label.y + 4} textAnchor="end" fontSize="11" fill="#9CA3AF">{formatShort(label.value)}</text>
            </g>
          ))}

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="netWorthGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="netWorthLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaD} fill="url(#netWorthGradient)" />

          {/* Line */}
          <path d={pathD} fill="none" stroke="url(#netWorthLineGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Points and date labels */}
          {points.map((p, i) => {
            const isHovered = hoveredPoint === i;
            const date = new Date(p.date);
            const dateLabel = `${date.getDate()}.${date.getMonth() + 1}.${String(date.getFullYear()).slice(-2)}`;
            return (
              <g key={i}>
                <rect x={p.x - 25} y={paddingTop} width={50} height={chartHeight} fill="transparent" style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint(i)} onMouseLeave={() => setHoveredPoint(null)} />
                <circle cx={p.x} cy={p.y} r={isHovered ? 8 : 5} fill={p.equity >= 0 ? '#3B82F6' : '#EF4444'} stroke="white" strokeWidth={isHovered ? 3 : 2} style={{ transition: 'all 0.15s ease', cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint(i)} onMouseLeave={() => setHoveredPoint(null)} />
                <text x={p.x} y={height - 10} textAnchor="middle" fontSize="10" fill="#9CA3AF">{dateLabel}</text>
              </g>
            );
          })}
        </svg>
      </Box>

      {/* Hover tooltip */}
      {hoveredPoint !== null && points[hoveredPoint] && (
        <Box position="absolute" top="10px" right="20px" bg={colors.cardBg} p={3} borderRadius="12px" boxShadow="0 4px 16px rgba(0,0,0,0.15)" border="1px solid" borderColor={colors.borderColor} minW="160px" zIndex={10}>
          <Text fontSize="sm" fontWeight="700" color={colors.textPrimary} mb={2}>
            {new Date(points[hoveredPoint].date).toLocaleDateString()}
          </Text>
          <Flex justify="space-between" mb={1}>
            <Text fontSize="xs" color={colors.textSecondary}>Assets:</Text>
            <Text fontSize="xs" fontWeight="600" color="green.500">{formatCurrency(points[hoveredPoint].assets)}</Text>
          </Flex>
          <Flex justify="space-between" mb={1}>
            <Text fontSize="xs" color={colors.textSecondary}>Liabilities:</Text>
            <Text fontSize="xs" fontWeight="600" color="red.500">{formatCurrency(points[hoveredPoint].liabilities)}</Text>
          </Flex>
          <Box h="1px" bg={colors.borderColor} my={2} />
          <Flex justify="space-between">
            <Text fontSize="xs" color={colors.textSecondary}>Net Worth:</Text>
            <Text fontSize="sm" fontWeight="700" color={points[hoveredPoint].equity >= 0 ? 'blue.500' : 'red.500'}>
              {formatCurrency(points[hoveredPoint].equity)}
            </Text>
          </Flex>
        </Box>
      )}
    </Box>
  );
};

// Helper to format currency for tooltip
const formatTooltipCurrency = (amount) => {
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toLocaleString()}`;
};

// Generate dynamic metric descriptions based on actual values
const getMetricDescriptions = (totalAssets, totalLiabilities, liquidAssets, investments, monthlyExpenses, breakdown) => {
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) : 0;
  const debtRatioPercent = debtRatio * 100;
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
  const netWorth = totalAssets - totalLiabilities;
  const investmentRatio = netWorth > 0 ? (investments / netWorth) : 0;
  const investmentRatioPercent = investmentRatio * 100;
  const netWorthRatio = totalAssets > 0 ? netWorth / totalAssets : 0;

  // Find points from breakdown
  const getPoints = (label) => breakdown.find(b => b.label === label)?.points || 0;
  const getMax = (label) => breakdown.find(b => b.label === label)?.max || 0;

  return {
    'Low Debt Ratio': {
      what: 'How much debt you have vs. what you own',
      calculation: `${formatTooltipCurrency(totalLiabilities)} ÷ ${formatTooltipCurrency(totalAssets)} = ${debtRatioPercent.toFixed(1)}% debt ratio`,
      scoring: `30 × (1 - ${debtRatioPercent.toFixed(1)}%) = ${getPoints('Low Debt Ratio')} pts`,
      tip: debtRatioPercent > 50 ? 'Pay down debt to increase this score' : 'Great job keeping debt low!',
    },
    'Emergency Fund': {
      what: 'How many months you can survive on savings',
      calculation: `${formatTooltipCurrency(liquidAssets)} ÷ ${formatTooltipCurrency(monthlyExpenses)}/mo = ${monthsCovered.toFixed(1)} months`,
      scoring: `${monthsCovered.toFixed(1)} months × 5 pts = ${getPoints('Emergency Fund')} pts (max 30)`,
      tip: monthsCovered >= 6 ? 'Excellent emergency fund!' : 'Build up 6 months of expenses in cash/savings',
    },
    'Investments': {
      what: 'How much of your wealth is invested for growth',
      calculation: `${formatTooltipCurrency(investments)} ÷ ${formatTooltipCurrency(netWorth)} net worth = ${investmentRatioPercent.toFixed(1)}%`,
      scoring: `${investmentRatioPercent.toFixed(1)}% × 0.67 = ${getPoints('Investments')} pts (max 20 at 30%)`,
      tip: investmentRatioPercent >= 30 ? 'Strong investment allocation!' : 'Aim to invest 30%+ of your net worth',
    },
    'Positive Net Worth': {
      what: 'Do your assets exceed your debts?',
      calculation: `${formatTooltipCurrency(totalAssets)} - ${formatTooltipCurrency(totalLiabilities)} = ${formatTooltipCurrency(netWorth)} net worth`,
      scoring: netWorth > 0 ? `10 + (${(netWorthRatio * 100).toFixed(1)}% × 10) = ${getPoints('Positive Net Worth')} pts` : '0 pts (negative net worth)',
      tip: netWorth > 0 ? 'You have positive net worth!' : 'Focus on growing assets and reducing liabilities',
    },
  };
};

// Financial Health Score Gauge
const FinancialHealthScore = ({ totalAssets, totalLiabilities, liquidAssets, investments, monthlyExpenses, colors }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Calculate health score (0-100)
  const calculateScore = () => {
    let score = 0;
    const breakdown = [];

    // 1. Debt-to-Asset Ratio (30 points max)
    const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 1;
    const debtScore = Math.max(0, Math.round(30 * (1 - debtRatio)));
    score += debtScore;
    breakdown.push({ label: 'Low Debt Ratio', points: debtScore, max: 30 });

    // 2. Emergency Fund Coverage (30 points max)
    const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
    const emergencyScore = Math.min(30, Math.round(monthsCovered * 5));
    score += emergencyScore;
    breakdown.push({ label: 'Emergency Fund', points: emergencyScore, max: 30 });

    // 3. Investment Allocation (20 points max)
    const netWorth = totalAssets - totalLiabilities;
    const investmentRatio = netWorth > 0 ? investments / netWorth : 0;
    const investmentScore = Math.min(20, Math.round(investmentRatio * 66.67));
    score += investmentScore;
    breakdown.push({ label: 'Investments', points: investmentScore, max: 20 });

    // 4. Positive Net Worth (20 points max)
    const netWorthScore = netWorth > 0 ? Math.min(20, Math.round(10 + (netWorth / totalAssets) * 10)) : 0;
    score += netWorthScore;
    breakdown.push({ label: 'Positive Net Worth', points: netWorthScore, max: 20 });

    return { score: Math.round(score), breakdown };
  };

  const { score, breakdown } = calculateScore();

  // Determine score color
  const getScoreColor = () => {
    if (score >= 70) return '#10B981';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const scoreColor = getScoreColor();
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Box bg={colors.cardBg} borderRadius="20px" p={5} borderWidth="1px" borderColor={colors.borderSubtle} position="relative">
      <Flex align="center" gap={2} mb={4}>
        <Text fontSize="sm" fontWeight="700" color={colors.textMuted}>FINANCIAL HEALTH</Text>
        <Box
          position="relative"
          onMouseEnter={(e) => {
            // Only use hover on devices with fine pointer (mouse)
            if (window.matchMedia('(pointer: fine)').matches) {
              setShowTooltip(true);
            }
          }}
          onMouseLeave={(e) => {
            // Only use hover on devices with fine pointer (mouse)
            if (window.matchMedia('(pointer: fine)').matches) {
              setShowTooltip(false);
            }
          }}
          onClick={(e) => {
            // On touch devices, use click to toggle
            if (!window.matchMedia('(pointer: fine)').matches) {
              setShowTooltip(!showTooltip);
            }
          }}
          cursor="pointer"
        >
          <Text fontSize="sm" color={colors.textMuted} _hover={{ color: colors.textSecondary }}>ⓘ</Text>
        </Box>
        {/* Mobile: Full-screen overlay modal | Desktop: Positioned tooltip */}
        {showTooltip && (
          <>
            {/* Backdrop for mobile - click to close */}
            <Box
              display={{ base: 'block', md: 'none' }}
              position="fixed"
              top="0"
              left="0"
              right="0"
              bottom="0"
              bg="blackAlpha.700"
              zIndex={998}
              onClick={() => setShowTooltip(false)}
            />
            <Box
              position={{ base: 'fixed', md: 'absolute' }}
              top={{ base: '50%', md: '40px' }}
              left={{ base: '50%', md: '0' }}
              transform={{ base: 'translate(-50%, -50%)', md: 'none' }}
              bg={colors.cardBg}
              p={{ base: 4, md: 5 }}
              borderRadius="16px"
              boxShadow="0 12px 40px rgba(0,0,0,0.5)"
              border="3px solid"
              borderColor={scoreColor}
              zIndex={999}
              w={{ base: 'calc(100vw - 32px)', md: '380px' }}
              maxW="400px"
              maxH={{ base: '80vh', md: 'none' }}
              overflowY={{ base: 'auto', md: 'visible' }}
            >
              {/* Mobile close button */}
              <Flex display={{ base: 'flex', md: 'none' }} justify="space-between" align="center" mb={3}>
                <Text fontSize="md" fontWeight="700" color={colors.textPrimary}>How Your Score Is Calculated</Text>
                <Box
                  as="button"
                  onClick={() => setShowTooltip(false)}
                  p={1}
                  borderRadius="full"
                  bg={colors.rowStripedBg}
                  color={colors.textMuted}
                  _hover={{ bg: colors.borderColor }}
                  fontSize="lg"
                  lineHeight="1"
                >
                  ✕
                </Box>
              </Flex>
              {/* Desktop header */}
              <Text display={{ base: 'none', md: 'block' }} fontSize="sm" fontWeight="700" color={colors.textPrimary} mb={4}>How Your Score Is Calculated</Text>
              <VStack align="stretch" gap={{ base: 2, md: 3 }}>
                {Object.entries(getMetricDescriptions(totalAssets, totalLiabilities, liquidAssets, investments, monthlyExpenses, breakdown)).map(([label, info]) => (
                  <Box
                    key={label}
                    p={{ base: 2.5, md: 3 }}
                    bg={colors.rowStripedBg}
                    borderRadius="8px"
                    border="1px solid"
                    borderColor={colors.borderColor}
                    borderLeft="4px solid"
                    borderLeftColor={scoreColor}
                  >
                    <Text fontSize="xs" fontWeight="700" color={colors.textPrimary} mb={1}>{label}</Text>
                    <VStack align="stretch" gap={0.5}>
                      <Text fontSize="xs" color={colors.textSecondary}>{info.what}</Text>
                      <Text fontSize={{ base: '10px', md: 'xs' }} color="#F59E0B" fontWeight="600" fontFamily="mono">{info.calculation}</Text>
                      <Text fontSize={{ base: '10px', md: 'xs' }} color="#3B82F6" fontWeight="600" fontFamily="mono">{info.scoring}</Text>
                      <Text fontSize="xs" color={scoreColor} fontWeight="600">💡 {info.tip}</Text>
                    </VStack>
                  </Box>
                ))}
              </VStack>
              <Box mt={3} pt={3} borderTop="2px solid" borderColor={colors.borderColor}>
                <Text fontSize="xs" color={colors.textMuted} fontWeight="500" textAlign="center">
                  Score: 80+ Excellent | 60-79 Good | 40-59 Fair | &lt;40 Needs Work
                </Text>
              </Box>
            </Box>
          </>
        )}
      </Flex>
      <Flex align="center" gap={6} direction={{ base: 'column', md: 'row' }}>
        {/* Circular gauge */}
        <Box position="relative" w="120px" h="120px" flexShrink={0}>
          <svg width="120" height="120">
            <circle cx="60" cy="60" r="45" fill="none" stroke="#E5E7EB" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={scoreColor}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" textAlign="center">
            <Text fontSize="2xl" fontWeight="800" color={colors.textPrimary}>{score}</Text>
            <Text fontSize="xs" color={colors.textMuted}>/100</Text>
          </Box>
        </Box>

        {/* Score label and breakdown */}
        <VStack align="stretch" flex="1" gap={3}>
          <HStack justify="space-between">
            <Text fontSize="lg" fontWeight="700" color={scoreColor}>{getScoreLabel()}</Text>
          </HStack>
          {breakdown.map((item, i) => (
            <Flex key={i} justify="space-between" align="center">
              <Text fontSize="xs" color={colors.textSecondary}>{item.label}</Text>
              <HStack gap={2}>
                <Box w="60px" h="8px" bg={colors.rowStripedBg} borderRadius="full" overflow="hidden" border="1px solid" borderColor={colors.borderColor}>
                  <Box h="100%" w={`${(item.points / item.max) * 100}%`} bg={scoreColor} borderRadius="full" />
                </Box>
                <Text fontSize="xs" fontWeight="600" color={colors.textMuted} w="35px" textAlign="right">
                  {item.points}/{item.max}
                </Text>
              </HStack>
            </Flex>
          ))}
        </VStack>
      </Flex>
    </Box>
  );
};

// Emergency Fund Indicator
const EmergencyFundIndicator = ({ liquidAssets, monthlyExpenses, colors }) => {
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
  const target = 6;
  const progress = Math.min((monthsCovered / target) * 100, 100);

  const getStatus = () => {
    if (monthsCovered >= 6) return { label: 'Excellent', color: '#10B981', icon: '✅' };
    if (monthsCovered >= 3) return { label: 'Good', color: '#3B82F6', icon: '👍' };
    if (monthsCovered >= 1) return { label: 'Building', color: '#F59E0B', icon: '🔨' };
    return { label: 'Critical', color: '#EF4444', icon: '⚠️' };
  };

  const status = getStatus();

  return (
    <Box bg={colors.cardBg} borderRadius="16px" p={5} borderWidth="1px" borderColor={colors.borderSubtle}>
      <HStack justify="space-between" mb={3}>
        <VStack align="start" gap={0}>
          <Text fontSize="xs" color={colors.textMuted} fontWeight="600">EMERGENCY FUND</Text>
          <Heading size="lg" color={colors.textPrimary}>{monthsCovered.toFixed(1)} months</Heading>
        </VStack>
        <VStack align="end" gap={0}>
          <Text fontSize="xl">{status.icon}</Text>
          <Text fontSize="xs" color={status.color} fontWeight="700">{status.label}</Text>
        </VStack>
      </HStack>

      <Box h="8px" bg={colors.rowStripedBg} borderRadius="full" overflow="hidden" mb={2}>
        <Box h="100%" w={`${progress}%`} bg={status.color} borderRadius="full" transition="width 0.3s ease" />
      </Box>

      <Flex justify="space-between">
        <Text fontSize="xs" color={colors.textMuted}>Available: {formatCurrency(liquidAssets)}</Text>
        <Text fontSize="xs" color={colors.textMuted}>Target: 6 months</Text>
      </Flex>
    </Box>
  );
};

// Debt Payoff Projection Card
const DebtPayoffCard = ({ liability, liabilityType, linkedCategory, linkedRecurring, payments, colors }) => {
  const calculatePayoff = () => {
    const { outstanding_balance, monthly_payment, interest_rate } = liability;

    if (monthly_payment <= 0 || outstanding_balance <= 0) {
      return { months: null, totalInterest: null, payoffDate: null };
    }

    // Determine payment frequency from linked recurring payment
    const frequency = linkedRecurring?.frequency || 'monthly';

    // Get periods per year and actual payment amount per period
    const periodsPerYear = {
      daily: 365,
      weekly: 52,
      biweekly: 26,
      'semi-monthly': 24,
      monthly: 12,
      quarterly: 4,
      'semi-annually': 2,
      annually: 1,
    };

    const periods = periodsPerYear[frequency] || 12;

    // Use actual payment amount (not converted monthly) if we have linked recurring
    const paymentPerPeriod = linkedRecurring?.amount
      ? parseFloat(linkedRecurring.amount)
      : monthly_payment;

    const periodRate = (interest_rate || 0) / 100 / periods;
    let balance = outstanding_balance;
    let totalPeriods = 0;
    let totalInterest = 0;
    const maxPeriods = periods * 50; // 50 years max

    while (balance > 0.01 && totalPeriods < maxPeriods) {
      const interestThisPeriod = balance * periodRate;
      totalInterest += interestThisPeriod;

      if (interestThisPeriod >= paymentPerPeriod) {
        return { months: Infinity, totalInterest: Infinity, payoffDate: null, warning: 'Payment too low to cover interest' };
      }

      balance = balance + interestThisPeriod - paymentPerPeriod;
      totalPeriods++;
    }

    // Convert periods to months for display
    const months = Math.round((totalPeriods / periods) * 12);

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);

    return {
      months,
      totalInterest,
      payoffDate,
      years: Math.floor(months / 12),
      remainingMonths: months % 12,
      frequency,
      paymentPerPeriod,
      interestRate: interest_rate,
    };
  };

  const projection = calculatePayoff();
  const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
  const recentPayments = payments?.slice(0, 3) || [];

  return (
    <Box bg={colors.cardBg} borderRadius="12px" p={4} borderWidth="1px" borderColor={linkedCategory ? 'blue.200' : colors.borderSubtle}>
      <HStack justify="space-between" mb={3}>
        <HStack>
          <Text fontSize="lg">{liabilityType?.icon}</Text>
          <VStack align="start" gap={0}>
            <Text fontWeight="600" color={colors.textPrimary} fontSize="sm">{liability.creditor}</Text>
            {linkedCategory && (
              <Text fontSize="xs" color="blue.500">🔗 {linkedCategory.name}</Text>
            )}
          </VStack>
        </HStack>
        <Text fontSize="sm" fontWeight="700" color={colors.danger}>{formatCurrency(liability.outstanding_balance)}</Text>
      </HStack>

      {projection.warning ? (
        <Box bg={colors.dangerBg} p={3} borderRadius="8px">
          <Text fontSize="xs" color={colors.danger}>⚠️ {projection.warning}</Text>
        </Box>
      ) : projection.months === null ? (
        <Text fontSize="xs" color={colors.textMuted}>Add monthly payment to see projection</Text>
      ) : (
        <VStack align="stretch" gap={2}>
          {projection.frequency && projection.frequency !== 'monthly' && (
            <Flex justify="space-between">
              <Text fontSize="xs" color={colors.textMuted}>Payment</Text>
              <Text fontSize="xs" fontWeight="600" color="blue.500">
                {formatCurrency(projection.paymentPerPeriod)} {projection.frequency}
              </Text>
            </Flex>
          )}
          {projection.interestRate > 0 && (
            <Flex justify="space-between">
              <Text fontSize="xs" color={colors.textMuted}>Interest Rate</Text>
              <Text fontSize="xs" fontWeight="600" color={colors.textPrimary}>
                {projection.interestRate}%
              </Text>
            </Flex>
          )}
          <Flex justify="space-between">
            <Text fontSize="xs" color={colors.textMuted}>Payoff Date</Text>
            <Text fontSize="xs" fontWeight="600" color={colors.textPrimary}>{projection.payoffDate?.toLocaleDateString()}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text fontSize="xs" color={colors.textMuted}>Time to Payoff</Text>
            <Text fontSize="xs" fontWeight="600" color={colors.textPrimary}>
              {projection.years > 0 && `${projection.years}y `}{projection.remainingMonths}m
            </Text>
          </Flex>
          <Flex justify="space-between">
            <Text fontSize="xs" color={colors.textMuted}>Total Interest</Text>
            <Text fontSize="xs" fontWeight="600" color={colors.danger}>{formatCurrency(projection.totalInterest)}</Text>
          </Flex>
        </VStack>
      )}

      {/* Show payment history for linked liabilities */}
      {linkedCategory && totalPaid > 0 && (
        <Box mt={3} pt={3} borderTop="1px" borderColor={colors.borderSubtle}>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="xs" fontWeight="600" color={colors.textMuted}>RECENT PAYMENTS</Text>
            <Text fontSize="xs" fontWeight="700" color="green.500">{formatCurrency(totalPaid)} total</Text>
          </HStack>
          <VStack align="stretch" gap={1}>
            {recentPayments.map((payment) => (
              <Flex key={payment.id} justify="space-between" align="center">
                <Text fontSize="xs" color={colors.textSecondary}>
                  {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <Text fontSize="xs" fontWeight="600" color="green.600">{formatCurrency(payment.amount)}</Text>
              </Flex>
            ))}
            {payments?.length > 3 && (
              <Text fontSize="xs" color={colors.textMuted} textAlign="center">
                +{payments.length - 3} more payments
              </Text>
            )}
          </VStack>
        </Box>
      )}
    </Box>
  );
};

// ============================================
// MODAL COMPONENTS
// ============================================

// Asset Modal
const AssetModal = ({ isOpen, onClose, asset, categories, onSave, colors }) => {
  const [formData, setFormData] = useState({
    category_id: asset?.category_id || categories[0]?.id || '',
    name: asset?.name || '',
    amount: asset?.amount || 0,
    note: asset?.note || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        category_id: asset?.category_id || categories[0]?.id || '',
        name: asset?.name || '',
        amount: asset?.amount || 0,
        note: asset?.note || '',
      });
      setErrors({});
    }
  }, [isOpen, asset, categories]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (formData.amount < 0) newErrors.amount = 'Amount must be positive';
    return newErrors;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSaving(true);
    await onSave(formData);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px" w="90%" borderRadius="20px" bg={colors.cardBg} overflow="hidden">
            <Dialog.Header bg="linear-gradient(135deg, #10B981 0%, #059669 100%)" color="white" p={5}>
              <Flex justify="space-between" align="center">
                <Dialog.Title fontSize="lg" fontWeight="700">{asset ? 'Edit Asset' : 'Add New Asset'}</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton color="white" _hover={{ bg: 'whiteAlpha.200' }} />
                </Dialog.CloseTrigger>
              </Flex>
            </Dialog.Header>
            <Dialog.Body p={5}>
              <VStack gap={4}>
                <Box w="100%">
                  <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>Category</Text>
                  <Box
                    as="select"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    bg={colors.inputBg}
                    borderColor={colors.borderColor}
                    borderWidth="1px"
                    borderRadius="md"
                    px={3}
                    py={2}
                    fontSize="sm"
                    color={colors.textPrimary}
                    w="100%"
                    _hover={{ borderColor: colors.primary }}
                    _focus={{ borderColor: colors.primary, outline: 'none' }}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </Box>
                </Box>

                <Box w="100%">
                  <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>Asset Name *</Text>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Main Residence, TD Savings"
                    bg={colors.inputBg}
                    borderColor={errors.name ? 'red.500' : colors.borderColor}
                    color={colors.textPrimary}
                  />
                  {errors.name && <Text fontSize="xs" color="red.500" mt={1}>{errors.name}</Text>}
                </Box>

                <Box w="100%">
                  <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>Current Value *</Text>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={formatNumberWithSpaces(formData.amount)}
                    onChange={(e) => {
                      const val = parseFormattedNumber(e.target.value);
                      if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setFormData({ ...formData, amount: val === '' ? 0 : val });
                      }
                    }}
                    onBlur={(e) => {
                      const num = parseFloat(parseFormattedNumber(e.target.value)) || 0;
                      setFormData({ ...formData, amount: num });
                    }}
                    placeholder="Enter amount"
                    bg={colors.inputBg}
                    borderColor={errors.amount ? 'red.500' : colors.borderColor}
                    color={colors.textPrimary}
                  />
                  {errors.amount && <Text fontSize="xs" color="red.500" mt={1}>{errors.amount}</Text>}
                </Box>

                <Box w="100%">
                  <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>Note (optional)</Text>
                  <Textarea
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Any additional details..."
                    bg={colors.inputBg}
                    borderColor={colors.borderColor}
                    color={colors.textPrimary}
                    rows={2}
                  />
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer p={5} borderTop="1px" borderColor={colors.borderSubtle}>
              <HStack justify="flex-end" gap={3}>
                <Button variant="ghost" onClick={onClose} color={colors.textSecondary}>Cancel</Button>
                <Button colorScheme="green" onClick={handleSave} loading={saving}>{asset ? 'Save Changes' : 'Add Asset'}</Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

// Liability Modal
const LiabilityModal = ({ isOpen, onClose, liability, types, spendingCategories, recurringPayments, onSave, colors }) => {
  const [formData, setFormData] = useState({
    type_id: liability?.type_id || types[0]?.id || '',
    creditor: liability?.creditor || '',
    outstanding_balance: liability?.outstanding_balance || 0,
    monthly_payment: liability?.monthly_payment || 0,
    interest_rate: liability?.interest_rate || 0,
    original_balance: liability?.original_balance || 0,
    linked_category_id: liability?.linked_category_id || '',
    note: liability?.note || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [autoFilledPayment, setAutoFilledPayment] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        type_id: liability?.type_id || types[0]?.id || '',
        creditor: liability?.creditor || '',
        outstanding_balance: liability?.outstanding_balance || 0,
        monthly_payment: liability?.monthly_payment || 0,
        interest_rate: liability?.interest_rate || 0,
        original_balance: liability?.original_balance || liability?.outstanding_balance || 0,
        linked_category_id: liability?.linked_category_id || '',
        note: liability?.note || '',
      });
      setErrors({});
      setAutoFilledPayment(false);
    }
  }, [isOpen, liability, types]);

  // Auto-fill monthly payment from recurring payments when category is linked
  const handleCategoryChange = (categoryId) => {
    const updates = { linked_category_id: categoryId || null };

    // Look up recurring payment with this category
    if (categoryId && recurringPayments) {
      const recurringPayment = recurringPayments.find(
        (rp) => rp.category_id === categoryId && rp.is_active && rp.type === 'expense'
      );

      if (recurringPayment && recurringPayment.amount > 0) {
        // Only auto-fill if current monthly_payment is 0 or was auto-filled before
        if (formData.monthly_payment === 0 || autoFilledPayment) {
          // Convert to monthly based on frequency
          const monthlyAmount = convertToMonthly(recurringPayment.amount, recurringPayment.frequency);
          updates.monthly_payment = Math.round(monthlyAmount * 100) / 100; // Round to 2 decimals
          setAutoFilledPayment(true);
        }
      }
    }

    setFormData({ ...formData, ...updates });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.creditor.trim()) newErrors.creditor = 'Creditor name is required';
    if (formData.outstanding_balance < 0) newErrors.outstanding_balance = 'Balance must be positive';
    if (formData.monthly_payment < 0) newErrors.monthly_payment = 'Payment must be positive';
    if (formData.interest_rate < 0 || formData.interest_rate > 100) newErrors.interest_rate = 'Rate must be 0-100%';
    return newErrors;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSaving(true);
    await onSave(formData);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px" w="90%" borderRadius="20px" bg={colors.cardBg} overflow="hidden">
            <Dialog.Header bg="linear-gradient(135deg, #EF4444 0%, #DC2626 100%)" color="white" p={5}>
              <Flex justify="space-between" align="center">
                <Dialog.Title fontSize="lg" fontWeight="700">{liability ? 'Edit Liability' : 'Add New Liability'}</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton color="white" _hover={{ bg: 'whiteAlpha.200' }} />
                </Dialog.CloseTrigger>
              </Flex>
            </Dialog.Header>
            <Dialog.Body p={5}>
              <VStack gap={4}>
                <Box w="100%">
                  <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>Liability Type</Text>
                  <Box
                    as="select"
                    value={formData.type_id}
                    onChange={(e) => setFormData({ ...formData, type_id: e.target.value })}
                    bg={colors.inputBg}
                    borderColor={colors.borderColor}
                    borderWidth="1px"
                    borderRadius="md"
                    px={3}
                    py={2}
                    fontSize="sm"
                    color={colors.textPrimary}
                    w="100%"
                  >
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>{type.icon} {type.name}</option>
                    ))}
                  </Box>
                </Box>

                <Box w="100%">
                  <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>Creditor *</Text>
                  <Input
                    value={formData.creditor}
                    onChange={(e) => setFormData({ ...formData, creditor: e.target.value })}
                    placeholder="e.g., TD Bank, Honda Finance"
                    bg={colors.inputBg}
                    borderColor={errors.creditor ? 'red.500' : colors.borderColor}
                    color={colors.textPrimary}
                  />
                  {errors.creditor && <Text fontSize="xs" color="red.500" mt={1}>{errors.creditor}</Text>}
                </Box>

                <Box w="100%">
                  <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>
                    Link to Spending Category
                    <Text as="span" fontSize="xs" color={colors.textMuted} fontWeight="400" ml={2}>
                      (auto-reduce balance on payments)
                    </Text>
                  </Text>
                  <Box
                    as="select"
                    value={formData.linked_category_id}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    bg={colors.inputBg}
                    borderColor={colors.borderColor}
                    borderWidth="1px"
                    borderRadius="md"
                    px={3}
                    py={2}
                    fontSize="sm"
                    color={colors.textPrimary}
                    w="100%"
                    _hover={{ borderColor: colors.primary }}
                  >
                    <option value="">— No link (manual tracking) —</option>
                    {spendingCategories.map((cat) => {
                      // Show recurring payment amount (converted to monthly) next to category if available
                      const recurringPayment = recurringPayments?.find(
                        (rp) => rp.category_id === cat.id && rp.is_active && rp.type === 'expense'
                      );
                      const monthlyAmount = recurringPayment
                        ? convertToMonthly(recurringPayment.amount, recurringPayment.frequency)
                        : 0;
                      const amountHint = recurringPayment ? ` (${formatCurrency(monthlyAmount)}/mo)` : '';
                      return (
                        <option key={cat.id} value={cat.id}>{cat.name}{amountHint}</option>
                      );
                    })}
                  </Box>
                  {formData.linked_category_id && (() => {
                    const linkedRecurring = recurringPayments?.find(
                      (rp) => rp.category_id === formData.linked_category_id && rp.is_active && rp.type === 'expense'
                    );
                    return (
                      <VStack align="start" gap={1} mt={1}>
                        <Text fontSize="xs" color="green.500">
                          ✓ When you spend in this category, the balance will automatically decrease
                        </Text>
                        {linkedRecurring?.end_date && (
                          <Text fontSize="xs" color="blue.500">
                            📅 Recurring ends: {new Date(linkedRecurring.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                        )}
                        {linkedRecurring && !linkedRecurring.end_date && (
                          <Text fontSize="xs" color={colors.textMuted}>
                            ℹ️ No end date set on recurring payment
                          </Text>
                        )}
                      </VStack>
                    );
                  })()}
                </Box>

                <SimpleGrid columns={2} gap={4} w="100%">
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>Outstanding Balance *</Text>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formatNumberWithSpaces(formData.outstanding_balance)}
                      onChange={(e) => {
                        const val = parseFormattedNumber(e.target.value);
                        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setFormData({ ...formData, outstanding_balance: val === '' ? 0 : val });
                        }
                      }}
                      onBlur={(e) => {
                        const num = parseFloat(parseFormattedNumber(e.target.value)) || 0;
                        setFormData({ ...formData, outstanding_balance: num });
                      }}
                      placeholder="Enter amount"
                      bg={colors.inputBg}
                      borderColor={errors.outstanding_balance ? 'red.500' : colors.borderColor}
                      color={colors.textPrimary}
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>Original Balance</Text>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formatNumberWithSpaces(formData.original_balance)}
                      onChange={(e) => {
                        const val = parseFormattedNumber(e.target.value);
                        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setFormData({ ...formData, original_balance: val === '' ? 0 : val });
                        }
                      }}
                      onBlur={(e) => {
                        const num = parseFloat(parseFormattedNumber(e.target.value)) || 0;
                        setFormData({ ...formData, original_balance: num });
                      }}
                      placeholder="Enter amount"
                      bg={colors.inputBg}
                      borderColor={colors.borderColor}
                      color={colors.textPrimary}
                    />
                  </Box>
                </SimpleGrid>

                <SimpleGrid columns={2} gap={4} w="100%">
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>
                      Monthly Payment
                      {autoFilledPayment && (
                        <Text as="span" fontSize="xs" color="green.500" fontWeight="500" ml={2}>
                          ✓ from recurring
                        </Text>
                      )}
                    </Text>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formatNumberWithSpaces(formData.monthly_payment)}
                      onChange={(e) => {
                        const val = parseFormattedNumber(e.target.value);
                        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setFormData({ ...formData, monthly_payment: val === '' ? 0 : val });
                          setAutoFilledPayment(false);
                        }
                      }}
                      onBlur={(e) => {
                        const num = parseFloat(parseFormattedNumber(e.target.value)) || 0;
                        setFormData({ ...formData, monthly_payment: num });
                      }}
                      placeholder="Enter amount"
                      bg={colors.inputBg}
                      borderColor={autoFilledPayment ? 'green.500' : (errors.monthly_payment ? 'red.500' : colors.borderColor)}
                      color={colors.textPrimary}
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>Interest Rate (%)</Text>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g., 8.9"
                      value={formData.interest_rate === 0 ? '' : formData.interest_rate}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Allow empty, numbers, and decimal point
                        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setFormData({ ...formData, interest_rate: val === '' ? 0 : val });
                        }
                      }}
                      onBlur={(e) => {
                        // Convert to number on blur
                        const num = parseFloat(e.target.value) || 0;
                        setFormData({ ...formData, interest_rate: num });
                      }}
                      bg={colors.inputBg}
                      borderColor={errors.interest_rate ? 'red.500' : colors.borderColor}
                      color={colors.textPrimary}
                    />
                  </Box>
                </SimpleGrid>

                <Box w="100%">
                  <Text fontSize="sm" fontWeight="600" mb={2} color={colors.textSecondary}>Note (optional)</Text>
                  <Textarea
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Any additional details..."
                    bg={colors.inputBg}
                    borderColor={colors.borderColor}
                    color={colors.textPrimary}
                    rows={2}
                  />
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer p={5} borderTop="1px" borderColor={colors.borderSubtle}>
              <HStack justify="flex-end" gap={3}>
                <Button variant="ghost" onClick={onClose} color={colors.textSecondary}>Cancel</Button>
                <Button colorScheme="red" onClick={handleSave} loading={saving}>{liability ? 'Save Changes' : 'Add Liability'}</Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

// Delete Confirmation Dialog
const DeleteConfirmDialog = ({ isOpen, onClose, onConfirm, itemType, itemName, colors }) => {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content maxW="400px" w="90%" borderRadius="16px" bg={colors.cardBg} overflow="hidden">
            <Dialog.Header p={5}>
              <Flex align="center" gap={3}>
                <Box bg="red.100" p={2} borderRadius="full">
                  <Text fontSize="xl">⚠️</Text>
                </Box>
                <Dialog.Title fontSize="lg" fontWeight="700" color={colors.textPrimary}>Delete {itemType}?</Dialog.Title>
              </Flex>
            </Dialog.Header>
            <Dialog.Body px={5} pb={5}>
              <Text color={colors.textSecondary}>
                Are you sure you want to delete <Text as="span" fontWeight="700">"{itemName}"</Text>? This action cannot be undone.
              </Text>
            </Dialog.Body>
            <Dialog.Footer p={5} borderTop="1px" borderColor={colors.borderSubtle}>
              <HStack justify="flex-end" gap={3}>
                <Button variant="ghost" onClick={onClose} color={colors.textSecondary}>Cancel</Button>
                <Button colorScheme="red" onClick={handleConfirm} loading={deleting}>Delete</Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

// ============================================
// ROW COMPONENTS
// ============================================

// Summary Card Component
const SummaryCard = ({ title, value, trend, gradient, colors, icon }) => {
  return (
    <Box
      bg={colors.cardBg}
      borderRadius="20px"
      p={{ base: 4, md: 5 }}
      boxShadow={colors.cardShadow}
      position="relative"
      overflow="hidden"
      _hover={{ boxShadow: colors.cardHoverShadow, transform: 'translateY(-2px)' }}
      transition="all 0.3s ease"
      style={{ animation: 'fadeSlideIn 0.4s ease-out' }}
    >
      <Box position="absolute" top={0} left={0} right={0} bottom={0} bgGradient={gradient} opacity={0.05} pointerEvents="none" />
      <VStack align="stretch" gap={2} position="relative">
        <HStack justify="space-between">
          <Text fontSize="sm" color={colors.textMuted} fontWeight="600">{title}</Text>
          {icon && <Text fontSize="xl">{icon}</Text>}
        </HStack>
        <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color={colors.textPrimary} letterSpacing="-0.02em">{value}</Text>
        {trend !== undefined && trend !== null && (
          <HStack gap={1}>
            <Text fontSize="xs" color={trend >= 0 ? colors.success : colors.danger} fontWeight="600">
              {trend >= 0 ? '↗' : '↘'} {formatCurrency(Math.abs(trend))}
            </Text>
            <Text fontSize="xs" color={colors.textMuted}>vs previous</Text>
          </HStack>
        )}
      </VStack>
    </Box>
  );
};

// Asset Row Component
const AssetRow = ({ asset, category, totalAssets, onEdit, onDelete, colors }) => {
  const percentOfTotal = totalAssets > 0 ? (asset.amount / totalAssets) * 100 : 0;

  return (
    <Box
      bg={colors.cardBg}
      borderRadius="12px"
      p={4}
      borderWidth="1px"
      borderColor={colors.borderSubtle}
      _hover={{ bg: colors.rowHoverBg, borderColor: colors.borderColor }}
      transition="all 0.2s ease"
      cursor="pointer"
      onClick={() => onEdit(asset)}
    >
      {/* Desktop layout */}
      <Flex gap={3} alignItems="center" display={{ base: 'none', md: 'flex' }}>
        <HStack flex="1" minW="0">
          <Text fontSize="lg">{category?.icon}</Text>
          <Text fontSize="sm" fontWeight="600" color={colors.textSecondary} noOfLines={1}>{category?.name}</Text>
        </HStack>
        <Text flex="1" minW="0" fontSize="md" fontWeight="700" color={colors.textPrimary} noOfLines={1}>{asset.name}</Text>
        <Text flex="1" minW="0" fontSize="md" fontWeight="800" color={colors.success}>{formatCurrency(asset.amount)}</Text>
        <Text flex="1" minW="0" fontSize="sm" color={colors.textMuted} fontWeight="600">{percentOfTotal.toFixed(1)}%</Text>
        <Text flex="1" minW="0" fontSize="sm" color={colors.textSecondary} noOfLines={1}>{asset.note || '-'}</Text>
        <Box w="80px" textAlign="center">
          <Button
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={(e) => { e.stopPropagation(); onDelete(asset); }}
          >
            Delete
          </Button>
        </Box>
      </Flex>

      {/* Mobile layout */}
      <Box display={{ base: 'block', md: 'none' }}>
        <Flex justify="space-between" align="flex-start" mb={2}>
          <HStack gap={2} flex="1" minW="0">
            <Text fontSize="xl">{category?.icon}</Text>
            <Box flex="1" minW="0">
              <Text fontSize="md" fontWeight="700" color={colors.textPrimary} noOfLines={2}>{asset.name}</Text>
              <Text fontSize="xs" color={colors.textMuted}>{category?.name}</Text>
            </Box>
          </HStack>
          <Button
            size="xs"
            variant="ghost"
            colorPalette="red"
            onClick={(e) => { e.stopPropagation(); onDelete(asset); }}
          >
            Delete
          </Button>
        </Flex>
        <Flex justify="space-between" align="center">
          <HStack gap={3}>
            <Text fontSize="lg" fontWeight="800" color={colors.success}>{formatCurrency(asset.amount)}</Text>
            <Text fontSize="sm" color={colors.textMuted} fontWeight="600">({percentOfTotal.toFixed(1)}%)</Text>
          </HStack>
        </Flex>
        {asset.note && (
          <Text fontSize="xs" color={colors.textSecondary} mt={2} noOfLines={2}>{asset.note}</Text>
        )}
      </Box>
    </Box>
  );
};

// Liability Row Component
const LiabilityRow = ({ liability, type, linkedCategory, payments, onEdit, onDelete, colors }) => {
  const progress = liability.original_balance > 0
    ? ((liability.original_balance - liability.outstanding_balance) / liability.original_balance) * 100
    : 0;

  // Calculate total payments from linked category
  const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
  const paymentCount = payments?.length || 0;

  return (
    <Box
      bg={colors.cardBg}
      borderRadius="12px"
      p={4}
      borderWidth="1px"
      borderColor={linkedCategory ? 'blue.200' : colors.borderSubtle}
      _hover={{ bg: colors.rowHoverBg, borderColor: linkedCategory ? 'blue.400' : colors.borderColor }}
      transition="all 0.2s ease"
      cursor="pointer"
      onClick={() => onEdit(liability)}
    >
      {/* Desktop layout */}
      <Flex gap={3} alignItems="center" display={{ base: 'none', md: 'flex' }}>
        <HStack flex="1" minW="0">
          <Text fontSize="lg">{type?.icon}</Text>
          <VStack align="start" gap={0}>
            <Text fontSize="sm" fontWeight="600" color={colors.textSecondary} noOfLines={1}>{type?.name}</Text>
            {linkedCategory && (
              <HStack gap={1}>
                <Text fontSize="xs" color="blue.500">🔗</Text>
                <Text fontSize="xs" color="blue.500" fontWeight="500" noOfLines={1}>{linkedCategory.name}</Text>
              </HStack>
            )}
          </VStack>
        </HStack>
        <Text flex="1" minW="0" fontSize="md" fontWeight="700" color={colors.textPrimary} noOfLines={1}>{liability.creditor}</Text>
        <Box flex="1" minW="0">
          <Text fontSize="md" fontWeight="800" color={colors.danger}>{formatCurrency(liability.outstanding_balance)}</Text>
          {liability.original_balance > 0 && progress > 0 && (
            <HStack gap={2} mt={1}>
              <Box w="70px" h="6px" bg={colors.rowStripedBg} borderRadius="full" overflow="hidden" border="1px solid" borderColor={colors.borderColor}>
                <Box h="100%" w={`${progress}%`} bg="green.500" borderRadius="full" />
              </Box>
              <Text fontSize="xs" fontWeight="600" color="green.500">{progress.toFixed(1)}%</Text>
            </HStack>
          )}
        </Box>
        <Box flex="1" minW="0">
          <Text fontSize="sm" color={colors.textSecondary}>{formatCurrency(liability.monthly_payment)}/mo</Text>
          {linkedCategory && totalPaid > 0 && (
            <Text fontSize="xs" color="green.500" fontWeight="500">
              {formatCurrency(totalPaid)} paid ({paymentCount})
            </Text>
          )}
        </Box>
        <Text flex="1" minW="0" fontSize="sm" color={colors.textMuted}>{liability.interest_rate}% APR</Text>
        <Box w="80px" textAlign="center">
          <Button
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={(e) => { e.stopPropagation(); onDelete(liability); }}
          >
            Delete
          </Button>
        </Box>
      </Flex>

      {/* Mobile layout */}
      <Box display={{ base: 'block', md: 'none' }}>
        <Flex justify="space-between" align="flex-start" mb={2}>
          <HStack gap={2} flex="1" minW="0">
            <Text fontSize="xl">{type?.icon}</Text>
            <Box flex="1" minW="0">
              <Text fontSize="md" fontWeight="700" color={colors.textPrimary} noOfLines={2}>{liability.creditor}</Text>
              <HStack gap={1}>
                <Text fontSize="xs" color={colors.textMuted}>{type?.name}</Text>
                {linkedCategory && (
                  <>
                    <Text fontSize="xs" color="blue.500">🔗</Text>
                    <Text fontSize="xs" color="blue.500" fontWeight="500" noOfLines={1}>{linkedCategory.name}</Text>
                  </>
                )}
              </HStack>
            </Box>
          </HStack>
          <Button
            size="xs"
            variant="ghost"
            colorPalette="red"
            onClick={(e) => { e.stopPropagation(); onDelete(liability); }}
          >
            Delete
          </Button>
        </Flex>
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
          <Box>
            <Text fontSize="lg" fontWeight="800" color={colors.danger}>{formatCurrency(liability.outstanding_balance)}</Text>
            {liability.original_balance > 0 && progress > 0 && (
              <HStack gap={2} mt={1}>
                <Box w="60px" h="6px" bg={colors.rowStripedBg} borderRadius="full" overflow="hidden" border="1px solid" borderColor={colors.borderColor}>
                  <Box h="100%" w={`${progress}%`} bg="green.500" borderRadius="full" />
                </Box>
                <Text fontSize="xs" fontWeight="600" color="green.500">{progress.toFixed(0)}%</Text>
              </HStack>
            )}
          </Box>
          <HStack gap={3} flexWrap="wrap">
            <Text fontSize="sm" color={colors.textSecondary}>{formatCurrency(liability.monthly_payment)}/mo</Text>
            <Text fontSize="sm" color={colors.textMuted}>{liability.interest_rate}% APR</Text>
          </HStack>
        </Flex>
        {linkedCategory && totalPaid > 0 && (
          <Text fontSize="xs" color="green.500" fontWeight="500" mt={2}>
            {formatCurrency(totalPaid)} paid ({paymentCount} payments)
          </Text>
        )}
      </Box>
    </Box>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function AssetsLiabilities() {
  const { user } = useAuth();
  const colors = useDarkModeColors();

  // State
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [assetCategories, setAssetCategories] = useState([]);
  const [liabilityTypes, setLiabilityTypes] = useState([]);
  const [spendingCategories, setSpendingCategories] = useState([]); // Expense categories for linking
  const [recurringPayments, setRecurringPayments] = useState([]); // For auto-filling monthly payments
  const [linkedCategoryPayments, setLinkedCategoryPayments] = useState({}); // Payments by category_id
  const [snapshots, setSnapshots] = useState([]);
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [compareDate, setCompareDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Monthly expenses (calculated from transactions)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);

  // Modal state
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [liabilityModalOpen, setLiabilityModalOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [snapshotsModalOpen, setSnapshotsModalOpen] = useState(false);

  // Chart hover state
  const [hoveredAssetCategory, setHoveredAssetCategory] = useState(null);
  const [othersExpanded, setOthersExpanded] = useState(false); // Whether "Other Assets" breakdown is expanded

  // Section collapse state (collapsed by default)
  const [assetsExpanded, setAssetsExpanded] = useState(false);
  const [liabilitiesExpanded, setLiabilitiesExpanded] = useState(false);

  // Load data
  useEffect(() => {
    if (user) {
      loadData();
      loadMonthlyExpenses();
    }
  }, [user]);

  const loadMonthlyExpenses = async () => {
    try {
      // First, try to get the user's current monthly budget plan
      const currentDate = new Date();
      const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthStr = firstOfMonth.toISOString().split('T')[0]; // e.g., "2026-01-01"

      const { data: budgetData } = await supabase
        .from('budgets')
        .select('id, total')
        .eq('user_id', user.id)
        .eq('month', monthStr)
        .single();

      if (budgetData?.total > 0) {
        // Use the budget plan amount as monthly expenses
        setMonthlyExpenses(parseFloat(budgetData.total));
        return;
      }

      // Fallback: Calculate from actual transactions (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount, type, date')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', twelveMonthsAgo.toISOString().split('T')[0]);

      if (error) throw error;

      if (transactions && transactions.length > 0) {
        // Count actual months with data
        const monthsWithData = new Set(
          transactions.map((t) => {
            const d = new Date(t.date);
            return `${d.getFullYear()}-${d.getMonth()}`;
          })
        );
        const actualMonths = Math.max(1, monthsWithData.size);

        const totalExpenses = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const avgMonthly = totalExpenses / actualMonths;
        setMonthlyExpenses(avgMonthly);
      }
    } catch (error) {
      console.error('Error loading monthly expenses:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load asset categories
      let { data: assetCats, error: assetCatsError } = await supabase
        .from('asset_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (assetCatsError) throw assetCatsError;

      if (!assetCats || assetCats.length === 0) {
        const { data: newCats } = await supabase
          .from('asset_categories')
          .insert(defaultAssetCategories.map((cat) => ({ user_id: user.id, name: cat.name, icon: cat.icon })))
          .select();
        assetCats = newCats || [];
      }
      setAssetCategories(assetCats);

      // Load liability types
      let { data: liabTypes, error: liabTypesError } = await supabase
        .from('liability_types')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (liabTypesError) throw liabTypesError;

      if (!liabTypes || liabTypes.length === 0) {
        const { data: newTypes } = await supabase
          .from('liability_types')
          .insert(defaultLiabilityTypes.map((type) => ({ user_id: user.id, name: type.name, icon: type.icon })))
          .select();
        liabTypes = newTypes || [];
      }
      setLiabilityTypes(liabTypes);

      // Load assets
      const { data: assetsData, error: assetsError } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order');

      if (assetsError) throw assetsError;
      setAssets(assetsData || []);

      // Load liabilities
      const { data: liabsData, error: liabsError } = await supabase
        .from('liabilities')
        .select('*')
        .eq('user_id', user.id);

      if (liabsError) throw liabsError;
      setLiabilities(liabsData || []);

      // Load spending categories (expense type) for linking to liabilities
      const { data: spendingCats, error: spendingCatsError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .order('name');

      if (spendingCatsError) throw spendingCatsError;
      setSpendingCategories(spendingCats || []);

      // Load recurring payments (for auto-filling monthly payment amounts)
      const { data: recurringData, error: recurringError } = await supabase
        .from('recurring_payments')
        .select('id, name, amount, category_id, type, is_active, start_date, end_date, frequency')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (recurringError) throw recurringError;
      setRecurringPayments(recurringData || []);

      // Load payments for linked categories (last 12 months)
      const linkedCategoryIds = (liabsData || [])
        .filter(l => l.linked_category_id)
        .map(l => l.linked_category_id);

      if (linkedCategoryIds.length > 0) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const { data: paymentsData, error: paymentsError } = await supabase
          .from('transactions')
          .select('id, amount, date, category_id, description, provider')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .in('category_id', linkedCategoryIds)
          .gte('date', oneYearAgo.toISOString().split('T')[0])
          .order('date', { ascending: false });

        if (paymentsError) throw paymentsError;

        // Group payments by category_id
        const paymentsByCategory = {};
        (paymentsData || []).forEach(payment => {
          if (!paymentsByCategory[payment.category_id]) {
            paymentsByCategory[payment.category_id] = [];
          }
          paymentsByCategory[payment.category_id].push(payment);
        });
        setLinkedCategoryPayments(paymentsByCategory);
      }

      // Load snapshots
      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('net_worth_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('record_date', { ascending: false })
        .limit(20);

      if (snapshotsError) throw snapshotsError;
      setSnapshots(snapshotsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Asset CRUD
  const handleSaveAsset = async (formData) => {
    let updatedAssets;

    if (editingAsset) {
      const { error } = await supabase.from('assets').update(formData).eq('id', editingAsset.id);
      if (error) { console.error('Error updating asset:', error); return; }
      updatedAssets = assets.map((a) => (a.id === editingAsset.id ? { ...a, ...formData } : a));
      setAssets(updatedAssets);
    } else {
      const { data, error } = await supabase
        .from('assets')
        .insert([{ ...formData, user_id: user.id, display_order: assets.length }])
        .select();
      if (error) { console.error('Error adding asset:', error); return; }
      if (data && data[0]) {
        updatedAssets = [...assets, data[0]];
        setAssets(updatedAssets);
      }
    }

    // Auto-save snapshot with updated data
    if (updatedAssets) {
      await autoSaveSnapshot(updatedAssets, liabilities);
    }
  };

  const handleDeleteAsset = async () => {
    if (!itemToDelete) return;
    const { error } = await supabase.from('assets').delete().eq('id', itemToDelete.id);
    if (error) { console.error('Error deleting asset:', error); return; }
    const updatedAssets = assets.filter((a) => a.id !== itemToDelete.id);
    setAssets(updatedAssets);
    setItemToDelete(null);

    // Auto-save snapshot with updated data
    await autoSaveSnapshot(updatedAssets, liabilities);
  };

  // Liability CRUD
  const handleSaveLiability = async (formData) => {
    let updatedLiabilities;

    if (editingLiability) {
      const { error } = await supabase.from('liabilities').update(formData).eq('id', editingLiability.id);
      if (error) { console.error('Error updating liability:', error); return; }
      updatedLiabilities = liabilities.map((l) => (l.id === editingLiability.id ? { ...l, ...formData } : l));
      setLiabilities(updatedLiabilities);
    } else {
      const { data, error } = await supabase
        .from('liabilities')
        .insert([{ ...formData, user_id: user.id }])
        .select();
      if (error) { console.error('Error adding liability:', error); return; }
      if (data && data[0]) {
        updatedLiabilities = [...liabilities, data[0]];
        setLiabilities(updatedLiabilities);
      }
    }

    // Auto-save snapshot with updated data
    if (updatedLiabilities) {
      await autoSaveSnapshot(assets, updatedLiabilities);
    }

    // Reload linked category payments if a new category was linked
    if (formData.linked_category_id && !linkedCategoryPayments[formData.linked_category_id]) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const { data: paymentsData } = await supabase
        .from('transactions')
        .select('id, amount, date, category_id, description, provider')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('category_id', formData.linked_category_id)
        .gte('date', oneYearAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (paymentsData) {
        setLinkedCategoryPayments((prev) => ({
          ...prev,
          [formData.linked_category_id]: paymentsData,
        }));
      }
    }
  };

  const handleDeleteLiability = async () => {
    if (!itemToDelete) return;
    const { error } = await supabase.from('liabilities').delete().eq('id', itemToDelete.id);
    if (error) { console.error('Error deleting liability:', error); return; }
    const updatedLiabilities = liabilities.filter((l) => l.id !== itemToDelete.id);
    setLiabilities(updatedLiabilities);
    setItemToDelete(null);

    // Auto-save snapshot with updated data
    await autoSaveSnapshot(assets, updatedLiabilities);
  };

  // Auto-save snapshot helper (called after asset/liability changes)
  const autoSaveSnapshot = async (currentAssets, currentLiabilities) => {
    const totalAssetsValue = currentAssets.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    const totalLiabilitiesValue = currentLiabilities.reduce((sum, l) => sum + (parseFloat(l.outstanding_balance) || 0), 0);
    const equityValue = totalAssetsValue - totalLiabilitiesValue;

    const today = new Date().toISOString().split('T')[0];

    const snapshot = {
      user_id: user.id,
      record_date: today,
      total_assets: totalAssetsValue,
      total_liabilities: totalLiabilitiesValue,
      equity: equityValue,
      assets_breakdown: JSON.stringify(currentAssets),
      liabilities_breakdown: JSON.stringify(currentLiabilities),
    };

    const { error } = await supabase
      .from('net_worth_snapshots')
      .upsert([snapshot], { onConflict: 'user_id,record_date' });

    if (error) {
      console.error('Error auto-saving snapshot:', error);
    } else {
      // Refresh snapshots to update the chart
      const { data: snapshotsData } = await supabase
        .from('net_worth_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('record_date', { ascending: false })
        .limit(20);
      if (snapshotsData) setSnapshots(snapshotsData);
    }
  };

  // Manual save snapshot (for backdating or specific dates)
  const saveSnapshot = async () => {
    setSaving(true);
    try {
      const snapshot = {
        user_id: user.id,
        record_date: recordDate,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        equity: equity,
        assets_breakdown: JSON.stringify(assets),
        liabilities_breakdown: JSON.stringify(liabilities),
      };

      const { error } = await supabase
        .from('net_worth_snapshots')
        .upsert([snapshot], { onConflict: 'user_id,record_date' });

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error saving snapshot:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete snapshot
  const deleteSnapshot = async (snapshotId) => {
    try {
      const { error } = await supabase
        .from('net_worth_snapshots')
        .delete()
        .eq('id', snapshotId);

      if (error) throw error;

      // Update local state
      const deletedSnapshot = snapshots.find((s) => s.id === snapshotId);
      setSnapshots(snapshots.filter((s) => s.id !== snapshotId));

      // Clear compare date if the deleted snapshot was selected
      if (deletedSnapshot && compareDate === deletedSnapshot.record_date) {
        setCompareDate('');
      }
    } catch (error) {
      console.error('Error deleting snapshot:', error);
    }
  };

  // Calculate metrics
  const totalAssets = assets.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + (parseFloat(l.outstanding_balance) || 0), 0);
  const equity = totalAssets - totalLiabilities;
  const debtToAssetsRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  // Equity change
  let equityChange = null;
  if (compareDate && snapshots.length > 0) {
    const compareSnapshot = snapshots.find((s) => s.record_date === compareDate);
    if (compareSnapshot) equityChange = equity - compareSnapshot.equity;
  }

  // Category-specific calculations
  // Emergency fund includes: Cash, Savings, TFSA, and RRSP (all accessible in emergencies)
  const liquidAssets = assets
    .filter((a) => {
      const cat = assetCategories.find((c) => c.id === a.category_id);
      return cat?.name === 'Cash' || cat?.name === 'Savings Account' || cat?.name === 'TFSA' || cat?.name === 'RRSP';
    })
    .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

  const investments = assets
    .filter((a) => {
      const cat = assetCategories.find((c) => c.id === a.category_id);
      return cat?.name === 'RRSP' || cat?.name === 'TFSA' || cat?.name === 'Investment';
    })
    .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

  const realEstateAssets = assets
    .filter((a) => {
      const cat = assetCategories.find((c) => c.id === a.category_id);
      return cat?.name === 'Real Estate';
    })
    .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

  const mortgageLiabilities = liabilities
    .filter((l) => {
      const type = liabilityTypes.find((t) => t.id === l.type_id);
      return type?.name === 'Mortgage';
    })
    .reduce((sum, l) => sum + parseFloat(l.outstanding_balance || 0), 0);

  const homeEquity = realEstateAssets - mortgageLiabilities;

  if (loading) {
    return (
      <PageContainer>
        <Flex justify="center" align="center" minH="50vh">
          <Spinner size="xl" color={colors.primary} />
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <VStack align="stretch" gap={6}>
        {/* Header */}
        <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} gap={4}>
          <HStack>
            <Text fontSize="3xl">💰</Text>
            <Heading size="2xl" color={colors.textPrimary}>Assets & Liabilities</Heading>
          </HStack>
          <Flex gap={3} align="center" flexWrap="wrap" justify={{ base: 'flex-start', md: 'flex-end' }}>
            <HStack gap={3}>
              <Input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                bg={colors.inputBg}
                borderColor={colors.borderColor}
                color={colors.textPrimary}
                w="160px"
              />
              <Box
                as="select"
                value={compareDate}
                onChange={(e) => setCompareDate(e.target.value)}
                bg={colors.inputBg}
                borderColor={colors.borderColor}
                borderWidth="1px"
                borderRadius="md"
                px={3}
                py={2}
                fontSize="sm"
                color={colors.textPrimary}
                w="160px"
                cursor="pointer"
                _hover={{ borderColor: colors.primary }}
              >
                <option value="">Compare to...</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.record_date}>{new Date(s.record_date).toLocaleDateString()}</option>
                ))}
              </Box>
            </HStack>
            <Button
              colorScheme="blue"
              onClick={saveSnapshot}
              loading={saving}
            >
              <HStack gap={2}>
                <Text fontSize="sm">📸</Text>
                <Text>Save Snapshot</Text>
              </HStack>
            </Button>
          </Flex>
        </Flex>

        {/* Summary Cards */}
        <SimpleGrid columns={{ base: 2, sm: 3, md: 5 }} gap={4}>
          <SummaryCard title="Total Assets" value={formatCurrency(totalAssets)} gradient="linear(to-br, green.500, green.700)" colors={colors} icon="📊" />
          <SummaryCard title="Total Liabilities" value={formatCurrency(totalLiabilities)} gradient="linear(to-br, red.500, red.700)" colors={colors} icon="💳" />
          <SummaryCard title="Net Worth" value={formatCurrency(equity)} gradient="linear(to-br, blue.500, blue.700)" colors={colors} icon="💎" trend={equityChange} />
          <SummaryCard title="Debt-to-Assets" value={formatPercent(debtToAssetsRatio)} gradient="linear(to-br, purple.500, purple.700)" colors={colors} icon="📈" />
          <SummaryCard title="Equity Change" value={equityChange !== null ? formatCurrency(equityChange) : '-'} gradient={equityChange >= 0 ? 'linear(to-br, green.500, green.700)' : 'linear(to-br, red.500, red.700)'} colors={colors} icon={equityChange >= 0 ? '↗️' : '↘️'} />
        </SimpleGrid>

        {/* Portfolio Overview - Charts & Health Score */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
          {/* Asset Allocation */}
          <Box bg={colors.cardBg} borderRadius="20px" p={5} borderWidth="1px" borderColor={colors.borderSubtle}>
            <Text fontSize="sm" fontWeight="700" color={colors.textMuted} mb={4}>ASSET ALLOCATION</Text>
            <Flex direction={{ base: 'column', md: 'row' }} align="center" gap={6}>
              {(() => {
                // Calculate category totals and group small ones into "Other Assets"
                const MIN_PERCENT = 5; // Categories below 5% go into "Other Assets"
                const categoryTotals = {};
                assets.forEach((asset) => {
                  const cat = assetCategories.find((c) => c.id === asset.category_id);
                  const catName = cat?.name || 'Other';
                  categoryTotals[catName] = (categoryTotals[catName] || 0) + parseFloat(asset.amount || 0);
                });

                // Separate into main categories and small ones
                const allCategories = Object.entries(categoryTotals)
                  .map(([name, amount]) => ({
                    name,
                    amount,
                    percent: totalAssets > 0 ? (amount / totalAssets) * 100 : 0,
                  }))
                  .sort((a, b) => b.amount - a.amount);

                const mainCategories = allCategories.filter((c) => c.percent >= MIN_PERCENT);
                const smallCategories = allCategories.filter((c) => c.percent < MIN_PERCENT && c.percent > 0);
                const othersTotal = smallCategories.reduce((sum, c) => sum + c.amount, 0);
                const othersPercent = totalAssets > 0 ? (othersTotal / totalAssets) * 100 : 0;

                // Build chart data with "Other Assets" grouped
                const chartData = othersTotal > 0
                  ? [...mainCategories, { name: 'Other Assets', amount: othersTotal, percent: othersPercent }]
                  : mainCategories;

                return (
                  <>
                    <AssetAllocationChart
                      assets={assets}
                      categories={assetCategories}
                      totalAssets={totalAssets}
                      hoveredCategory={hoveredAssetCategory}
                      onHoverCategory={setHoveredAssetCategory}
                      colors={colors}
                      groupedData={chartData}
                    />
                    {/* Legend */}
                    <VStack align="stretch" flex="1" gap={2}>
                      {chartData.map((cat) => {
                        const isHovered = hoveredAssetCategory === cat.name;
                        const isOtherHovered = hoveredAssetCategory && !isHovered;
                        const isOthersCategory = cat.name === 'Other Assets';
                        return (
                          <Box key={cat.name}>
                            <Flex
                              align="center"
                              gap={2}
                              p={2}
                              borderRadius="md"
                              bg={isHovered || (isOthersCategory && othersExpanded) ? colors.rowHoverBg : 'transparent'}
                              opacity={isOtherHovered ? 0.4 : 1}
                              cursor="pointer"
                              transition="all 0.15s"
                              onClick={isOthersCategory ? () => setOthersExpanded(!othersExpanded) : undefined}
                              onMouseEnter={() => setHoveredAssetCategory(cat.name)}
                              onMouseLeave={() => setHoveredAssetCategory(null)}
                            >
                              <Box w="12px" h="12px" borderRadius="full" bg={getCategoryColor(cat.name)} />
                              <Text fontSize="sm" color={colors.textSecondary} flex="1">
                                {cat.name}
                              </Text>
                              {isOthersCategory && (
                                <Text fontSize="xs" color={colors.textMuted}>
                                  {othersExpanded ? '▼' : '▶'}
                                </Text>
                              )}
                              <Text fontSize="sm" fontWeight="600" color={colors.textPrimary}>{cat.percent.toFixed(1)}%</Text>
                            </Flex>
                            {/* Show breakdown when "Other Assets" is expanded */}
                            {isOthersCategory && othersExpanded && smallCategories.length > 0 && (
                              <VStack
                                align="stretch"
                                gap={0.5}
                                pl={{ base: 4, md: 6 }}
                                pr={{ base: 1, md: 2 }}
                                py={2}
                                mt={1}
                                bg={colors.rowStripedBg}
                                borderRadius="6px"
                                maxH={{ base: '120px', md: '150px' }}
                                overflowY="auto"
                              >
                                {smallCategories.map((otherCat) => (
                                  <Flex
                                    key={otherCat.name}
                                    justify="space-between"
                                    align="center"
                                    px={{ base: 1, md: 2 }}
                                    py={0.5}
                                    fontSize={{ base: '11px', md: 'xs' }}
                                  >
                                    <HStack gap={1.5} flex="1" minW="0">
                                      <Box
                                        w="6px"
                                        h="6px"
                                        borderRadius="full"
                                        bg={getCategoryColor(otherCat.name)}
                                        flexShrink={0}
                                      />
                                      <Text color={colors.textSecondary} noOfLines={1} flex="1" minW="0">
                                        {otherCat.name}
                                      </Text>
                                    </HStack>
                                    <HStack gap={2} flexShrink={0} ml={2}>
                                      <Text fontWeight="500" color={colors.textPrimary}>
                                        {formatCurrency(otherCat.amount)}
                                      </Text>
                                      <Text color={colors.textMuted}>
                                        ({otherCat.percent.toFixed(1)}%)
                                      </Text>
                                    </HStack>
                                  </Flex>
                                ))}
                              </VStack>
                            )}
                          </Box>
                        );
                      })}
                    </VStack>
                  </>
                );
              })()}
            </Flex>
          </Box>

          {/* Financial Health Score */}
          <FinancialHealthScore
            totalAssets={totalAssets}
            totalLiabilities={totalLiabilities}
            liquidAssets={liquidAssets}
            investments={investments}
            monthlyExpenses={monthlyExpenses}
            colors={colors}
          />
        </SimpleGrid>

        {/* Emergency Fund & Key Metrics */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4}>
          <EmergencyFundIndicator liquidAssets={liquidAssets} monthlyExpenses={monthlyExpenses} colors={colors} />
          <Box bg={colors.cardBg} borderRadius="16px" p={5} borderWidth="1px" borderColor={colors.borderSubtle}>
            <Text fontSize="xs" color={colors.textMuted} fontWeight="600" mb={1}>HOME EQUITY</Text>
            <Text fontSize="2xl" fontWeight="800" color={colors.textPrimary}>{formatCurrency(homeEquity)}</Text>
            <Text fontSize="xs" color={colors.textSecondary} mt={1}>Real Estate - Mortgage</Text>
          </Box>
          <Box bg={colors.cardBg} borderRadius="16px" p={5} borderWidth="1px" borderColor={colors.borderSubtle}>
            <Text fontSize="xs" color={colors.textMuted} fontWeight="600" mb={1}>INVESTMENTS</Text>
            <Text fontSize="2xl" fontWeight="800" color={colors.textPrimary}>{formatCurrency(investments)}</Text>
            <Text fontSize="xs" color={colors.textSecondary} mt={1}>{equity > 0 ? `${((investments / equity) * 100).toFixed(0)}% of net worth` : '-'}</Text>
          </Box>
          <Box bg={colors.cardBg} borderRadius="16px" p={5} borderWidth="1px" borderColor={colors.borderSubtle}>
            <Text fontSize="xs" color={colors.textMuted} fontWeight="600" mb={1}>LIQUID ASSETS</Text>
            <Text fontSize="2xl" fontWeight="800" color={colors.textPrimary}>{formatCurrency(liquidAssets)}</Text>
            <Text fontSize="xs" color={colors.textSecondary} mt={1}>{totalAssets > 0 ? `${((liquidAssets / totalAssets) * 100).toFixed(0)}% of total assets` : '-'}</Text>
          </Box>
        </SimpleGrid>

        {/* Assets Section */}
        <Box>
          <Box
            bg="linear-gradient(135deg, #10B981 0%, #059669 100%)"
            borderRadius={assetsExpanded ? "16px 16px 0 0" : "16px"}
            p={4}
            cursor="pointer"
            onClick={() => setAssetsExpanded(!assetsExpanded)}
            transition="border-radius 0.2s"
          >
            <Flex justify="space-between" align="center">
              <HStack gap={2}>
                <Text
                  fontSize="lg"
                  transition="transform 0.2s"
                  transform={assetsExpanded ? "rotate(90deg)" : "rotate(0deg)"}
                >
                  ▶
                </Text>
                <Text fontSize="xl">📊</Text>
                <Heading size={{ base: 'md', md: 'lg' }} color="white">Assets</Heading>
              </HStack>
              <HStack gap={3}>
                <Text
                  color="white"
                  fontSize={{ base: 'md', md: 'lg' }}
                  fontWeight="bold"
                >
                  {formatCurrency(totalAssets)}
                </Text>
                <Button
                  bg="white"
                  color="green.700"
                  size="sm"
                  _hover={{ bg: 'gray.100' }}
                  onClick={(e) => { e.stopPropagation(); setEditingAsset(null); setAssetModalOpen(true); }}
                  borderRadius="full"
                  w="32px"
                  h="32px"
                  minW="32px"
                  p={0}
                  fontWeight="bold"
                  fontSize="xl"
                >
                  +
                </Button>
              </HStack>
            </Flex>
          </Box>
          {assetsExpanded && (
            <Box bg={colors.cardBg} borderRadius="0 0 16px 16px" p={4} borderWidth="1px" borderColor={colors.borderColor} borderTop="none">
              <Box p={4} pb={3} mb={3} borderBottom="1px" borderColor={colors.borderColor} display={{ base: 'none', md: 'block' }}>
                <Flex gap={3}>
                  <HStack flex="1" minW="0">
                    <Text fontSize="xs" fontWeight="700" color={colors.textMuted}>CATEGORY</Text>
                  </HStack>
                  <Text flex="1" minW="0" fontSize="xs" fontWeight="700" color={colors.textMuted}>NAME</Text>
                  <Text flex="1" minW="0" fontSize="xs" fontWeight="700" color={colors.textMuted}>VALUE</Text>
                  <Text flex="1" minW="0" fontSize="xs" fontWeight="700" color={colors.textMuted}>% OF TOTAL</Text>
                  <Text flex="1" minW="0" fontSize="xs" fontWeight="700" color={colors.textMuted}>NOTE</Text>
                  <Box w="80px" textAlign="center">
                    <Text fontSize="xs" fontWeight="700" color={colors.textMuted}>ACTIONS</Text>
                  </Box>
                </Flex>
              </Box>
              <VStack align="stretch" gap={2}>
                {assets.length === 0 ? (
                  <Box textAlign="center" py={8}>
                    <Text fontSize="3xl" mb={2}>🏦</Text>
                    <Text color={colors.textMuted} fontSize="md">No assets yet. Click "Add Asset" to get started.</Text>
                  </Box>
                ) : (
                  <>
                    {[...assets].sort((a, b) => parseFloat(b.amount || 0) - parseFloat(a.amount || 0)).slice(0, 2).map((asset) => (
                      <AssetRow
                        key={asset.id}
                        asset={asset}
                        category={assetCategories.find((c) => c.id === asset.category_id)}
                        totalAssets={totalAssets}
                        onEdit={(a) => { setEditingAsset(a); setAssetModalOpen(true); }}
                        onDelete={(a) => { setItemToDelete({ ...a, type: 'asset', name: a.name }); setDeleteConfirmOpen(true); }}
                        colors={colors}
                      />
                    ))}
                    {assets.length > 2 && (
                      <Text fontSize="sm" color={colors.textMuted} textAlign="center" py={2}>
                        +{assets.length - 2} more assets
                      </Text>
                    )}
                  </>
                )}
              </VStack>
            </Box>
          )}
        </Box>

        {/* Liabilities Section */}
        <Box>
          <Box
            bg="linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
            borderRadius={liabilitiesExpanded ? "16px 16px 0 0" : "16px"}
            p={4}
            cursor="pointer"
            onClick={() => setLiabilitiesExpanded(!liabilitiesExpanded)}
            transition="border-radius 0.2s"
          >
            <Flex justify="space-between" align="center">
              <HStack gap={2}>
                <Text
                  fontSize="lg"
                  transition="transform 0.2s"
                  transform={liabilitiesExpanded ? "rotate(90deg)" : "rotate(0deg)"}
                >
                  ▶
                </Text>
                <Text fontSize="xl">💳</Text>
                <Heading size={{ base: 'md', md: 'lg' }} color="white">Liabilities</Heading>
              </HStack>
              <HStack gap={3}>
                <Text
                  color="white"
                  fontSize={{ base: 'md', md: 'lg' }}
                  fontWeight="bold"
                >
                  {formatCurrency(totalLiabilities)}
                </Text>
                <Button
                  bg="white"
                  color="red.700"
                  size="sm"
                  _hover={{ bg: 'gray.100' }}
                  onClick={(e) => { e.stopPropagation(); setEditingLiability(null); setLiabilityModalOpen(true); }}
                  borderRadius="full"
                  w="32px"
                  h="32px"
                  minW="32px"
                  p={0}
                  fontWeight="bold"
                  fontSize="xl"
                >
                  +
                </Button>
              </HStack>
            </Flex>
          </Box>
          {liabilitiesExpanded && (
            <Box bg={colors.cardBg} borderRadius="0 0 16px 16px" p={4} borderWidth="1px" borderColor={colors.borderColor} borderTop="none">
              <Box p={4} pb={3} mb={3} borderBottom="1px" borderColor={colors.borderColor} display={{ base: 'none', md: 'block' }}>
                <Flex gap={3}>
                  <HStack flex="1" minW="0">
                    <Text fontSize="xs" fontWeight="700" color={colors.textMuted}>TYPE</Text>
                  </HStack>
                  <Text flex="1" minW="0" fontSize="xs" fontWeight="700" color={colors.textMuted}>CREDITOR</Text>
                  <Box flex="1" minW="0">
                    <Text fontSize="xs" fontWeight="700" color={colors.textMuted}>BALANCE</Text>
                  </Box>
                  <Box flex="1" minW="0">
                    <Text fontSize="xs" fontWeight="700" color={colors.textMuted}>PAYMENT</Text>
                  </Box>
                  <Text flex="1" minW="0" fontSize="xs" fontWeight="700" color={colors.textMuted}>INTEREST</Text>
                  <Box w="80px" textAlign="center">
                    <Text fontSize="xs" fontWeight="700" color={colors.textMuted}>ACTIONS</Text>
                  </Box>
                </Flex>
              </Box>
              <VStack align="stretch" gap={2}>
                {liabilities.length === 0 ? (
                  <Box textAlign="center" py={8}>
                    <Text fontSize="3xl" mb={2}>🎉</Text>
                    <Text color={colors.textMuted} fontSize="md">No debts! You're debt-free!</Text>
                  </Box>
                ) : (
                  <>
                    {[...liabilities].sort((a, b) => parseFloat(b.outstanding_balance || 0) - parseFloat(a.outstanding_balance || 0)).slice(0, 2).map((liability) => (
                      <LiabilityRow
                        key={liability.id}
                        liability={liability}
                        type={liabilityTypes.find((t) => t.id === liability.type_id)}
                        linkedCategory={liability.linked_category_id ? spendingCategories.find((c) => c.id === liability.linked_category_id) : null}
                        payments={liability.linked_category_id ? linkedCategoryPayments[liability.linked_category_id] : null}
                        onEdit={(l) => { setEditingLiability(l); setLiabilityModalOpen(true); }}
                        onDelete={(l) => { setItemToDelete({ ...l, type: 'liability', name: l.creditor }); setDeleteConfirmOpen(true); }}
                        colors={colors}
                      />
                    ))}
                    {liabilities.length > 2 && (
                      <Text fontSize="sm" color={colors.textMuted} textAlign="center" py={2}>
                        +{liabilities.length - 2} more liabilities
                      </Text>
                    )}
                  </>
                )}
              </VStack>
            </Box>
          )}
        </Box>

        {/* Liability Payoff Projections */}
        {liabilities.length > 0 && (
          <Box bg={colors.cardBg} borderRadius="20px" p={6} borderWidth="1px" borderColor={colors.borderSubtle}>
            <Heading size="md" mb={4} color={colors.textPrimary}>📅 Liability Payoff Projections</Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {[...liabilities].sort((a, b) => parseFloat(b.outstanding_balance || 0) - parseFloat(a.outstanding_balance || 0)).map((liability) => {
                const linkedRecurring = liability.linked_category_id
                  ? recurringPayments?.find((rp) => rp.category_id === liability.linked_category_id && rp.is_active && rp.type === 'expense')
                  : null;
                return (
                  <DebtPayoffCard
                    key={liability.id}
                    liability={liability}
                    liabilityType={liabilityTypes.find((t) => t.id === liability.type_id)}
                    linkedCategory={liability.linked_category_id ? spendingCategories.find((c) => c.id === liability.linked_category_id) : null}
                    linkedRecurring={linkedRecurring}
                    payments={liability.linked_category_id ? linkedCategoryPayments[liability.linked_category_id] : null}
                    colors={colors}
                  />
                );
              })}
            </SimpleGrid>
          </Box>
        )}

        {/* Net Worth Trend */}
        <Box bg={colors.cardBg} borderRadius="20px" p={6} borderWidth="1px" borderColor={colors.borderSubtle}>
          <HStack justify="space-between" mb={4}>
            <Heading size="md" color={colors.textPrimary}>📈 Net Worth Trend</Heading>
            <HStack gap={3}>
              <Text fontSize="sm" color={colors.textMuted} display={{ base: 'none', md: 'block' }}>{snapshots.length} snapshots</Text>
              {snapshots.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="blue"
                  onClick={() => setSnapshotsModalOpen(true)}
                >
                  Manage
                </Button>
              )}
            </HStack>
          </HStack>
          <NetWorthTrendChart snapshots={snapshots} colors={colors} />
        </Box>
      </VStack>

      {/* Modals */}
      <AssetModal
        isOpen={assetModalOpen}
        onClose={() => { setAssetModalOpen(false); setEditingAsset(null); }}
        asset={editingAsset}
        categories={assetCategories}
        onSave={handleSaveAsset}
        colors={colors}
      />

      <LiabilityModal
        isOpen={liabilityModalOpen}
        onClose={() => { setLiabilityModalOpen(false); setEditingLiability(null); }}
        liability={editingLiability}
        types={liabilityTypes}
        spendingCategories={spendingCategories}
        recurringPayments={recurringPayments}
        onSave={handleSaveLiability}
        colors={colors}
      />

      <DeleteConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setItemToDelete(null); }}
        onConfirm={itemToDelete?.type === 'asset' ? handleDeleteAsset : handleDeleteLiability}
        itemType={itemToDelete?.type === 'Asset' ? 'Asset' : 'Liability'}
        itemName={itemToDelete?.name || ''}
        colors={colors}
      />

      {/* Snapshots Management Modal */}
      <Dialog.Root open={snapshotsModalOpen} onOpenChange={(e) => !e.open && setSnapshotsModalOpen(false)}>
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" />
          <Dialog.Positioner>
            <Dialog.Content maxW="700px" w="95%" borderRadius="20px" bg={colors.cardBg} overflow="hidden" maxH="80vh">
              <Dialog.Header bg="linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)" color="white" p={5}>
                <Flex justify="space-between" align="center">
                  <Dialog.Title fontSize="lg" fontWeight="700">📊 Manage Snapshots</Dialog.Title>
                  <Dialog.CloseTrigger asChild>
                    <CloseButton color="white" _hover={{ bg: 'whiteAlpha.200' }} />
                  </Dialog.CloseTrigger>
                </Flex>
              </Dialog.Header>
              <Dialog.Body p={0} overflowY="auto" maxH="55vh">
                {snapshots.length === 0 ? (
                  <Box textAlign="center" py={8}>
                    <Text fontSize="3xl" mb={2}>📭</Text>
                    <Text color={colors.textMuted}>No snapshots yet</Text>
                  </Box>
                ) : (
                  <Box>
                    {/* Header */}
                    <Flex
                      px={5}
                      py={3}
                      bg={colors.rowStripedBg}
                      fontWeight="700"
                      fontSize="xs"
                      color={colors.textMuted}
                      position="sticky"
                      top={0}
                      zIndex={1}
                    >
                      <Text flex="1.2">DATE</Text>
                      <Text flex="1" textAlign="right">ASSETS</Text>
                      <Text flex="1" textAlign="right">LIABILITIES</Text>
                      <Text flex="1" textAlign="right">NET WORTH</Text>
                      <Box w="70px" textAlign="center">ACTION</Box>
                    </Flex>
                    {/* Rows */}
                    {snapshots.map((snapshot, index) => (
                      <Flex
                        key={snapshot.id}
                        px={5}
                        py={3}
                        align="center"
                        bg={index % 2 === 1 ? colors.rowStripedBg : 'transparent'}
                        borderBottom="1px"
                        borderColor={colors.borderSubtle}
                        _hover={{ bg: colors.rowHoverBg }}
                        transition="background 0.15s"
                      >
                        <Text flex="1.2" fontSize="sm" color={colors.textSecondary}>
                          {new Date(snapshot.record_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </Text>
                        <Text flex="1" fontSize="sm" fontWeight="500" color={colors.success} textAlign="right">
                          {formatCurrency(snapshot.total_assets)}
                        </Text>
                        <Text flex="1" fontSize="sm" fontWeight="500" color={colors.danger} textAlign="right">
                          {formatCurrency(snapshot.total_liabilities)}
                        </Text>
                        <Text flex="1" fontSize="sm" fontWeight="700" color={snapshot.equity >= 0 ? colors.success : colors.danger} textAlign="right">
                          {formatCurrency(snapshot.equity)}
                        </Text>
                        <Box w="70px" textAlign="center">
                          <Button
                            size="xs"
                            variant="ghost"
                            colorPalette="red"
                            onClick={() => deleteSnapshot(snapshot.id)}
                          >
                            Delete
                          </Button>
                        </Box>
                      </Flex>
                    ))}
                  </Box>
                )}
              </Dialog.Body>
              <Dialog.Footer p={4} borderTop="1px" borderColor={colors.borderSubtle}>
                <HStack justify="space-between" w="100%">
                  <Text fontSize="sm" color={colors.textMuted}>{snapshots.length} total snapshots</Text>
                  <Button variant="ghost" onClick={() => setSnapshotsModalOpen(false)}>Close</Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Animations */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </PageContainer>
  );
}
