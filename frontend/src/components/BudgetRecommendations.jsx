import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  Spinner,
  Collapsible,
  Grid,
} from '@chakra-ui/react';
import { useDarkModeColors } from '../lib/useDarkModeColors';
import { useAuth } from '../contexts/AuthContext';

// Icons using inline SVG
const ChevronIcon = ({ isOpen, size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease',
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const LightbulbIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18h6M10 22h4M12 2v1" />
    <path d="M12 6a6 6 0 0 1 4 10.5V18a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-1.5A6 6 0 0 1 12 6z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const RefreshIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 4v6h-6M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const AdjustIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20V10M18 20V4M6 20v-4" />
  </svg>
);

const SavingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M16 8l-4 4-2-2-4 4" />
  </svg>
);

// Priority configuration
const PRIORITY_CONFIG = {
  high: { label: 'High', emoji: '🔴', order: 1 },
  medium: { label: 'Medium', emoji: '🟡', order: 2 },
  low: { label: 'Low', emoji: '🟢', order: 3 },
};

// Type configuration
const TYPE_CONFIG = {
  underfunded: { emoji: '📈', label: 'Underfunded' },
  overfunded: { emoji: '📉', label: 'Overfunded' },
  high_variance: { emoji: '📊', label: 'Variable' },
  no_budget: { emoji: '⚠️', label: 'No Budget' },
  trending_up: { emoji: '🔺', label: 'Trending' },
  potential_savings: { emoji: '💰', label: 'Discretionary' },
};

const getPriorityStyles = (priority, colors) => {
  const styles = {
    high: { bg: colors.dangerBg, color: colors.danger, border: colors.dangerBorder },
    medium: { bg: colors.warningBg, color: colors.warning, border: colors.warningBorder },
    low: { bg: colors.successBg, color: colors.success, border: colors.successBorder },
  };
  return styles[priority] || styles.medium;
};

// Compact Recommendation Card
const RecommendationCard = ({ rec, colors, onApply, onDismiss, isApplying, formatCurrency, isSelected, onToggleSelect }) => {
  const priorityStyles = getPriorityStyles(rec.priority, colors);
  const typeConfig = TYPE_CONFIG[rec.type] || { emoji: '💡', label: 'Suggestion' };

  // Calculate the adjustment amount (difference between suggested and current)
  const adjustmentAmount = rec.suggestedBudget - rec.currentBudget;

  return (
    <Box
      p={3}
      bg={colors.cardBg}
      borderRadius="10px"
      border="2px solid"
      borderColor={isSelected ? priorityStyles.color : colors.borderSubtle}
      borderLeftWidth="3px"
      borderLeftColor={priorityStyles.color}
      position="relative"
      cursor="pointer"
      onClick={() => onToggleSelect(rec.categoryId)}
      _hover={{ borderColor: isSelected ? priorityStyles.color : colors.borderStrong }}
      transition="all 0.15s ease"
      opacity={isSelected ? 1 : 0.85}
      _active={{ transform: 'scale(0.99)' }}
    >
      {/* Selection Indicator */}
      <Box
        position="absolute"
        top={2}
        left={2}
        w="16px"
        h="16px"
        borderRadius="4px"
        border="2px solid"
        borderColor={isSelected ? priorityStyles.color : colors.borderStrong}
        bg={isSelected ? priorityStyles.color : 'transparent'}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {isSelected && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </Box>

      {/* Dismiss */}
      <Box
        position="absolute"
        top={2}
        right={2}
        p={1}
        borderRadius="full"
        cursor="pointer"
        color={colors.textMuted}
        opacity={0.6}
        _hover={{ opacity: 1, bg: colors.rowHoverBg }}
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(rec.categoryId, rec);
        }}
      >
        <XIcon />
      </Box>

      {/* Header */}
      <Flex justify="space-between" align="center" mb={2} pl={5} pr={5}>
        <HStack gap={2}>
          <Text fontSize="md">{typeConfig.emoji}</Text>
          <Text fontWeight="600" fontSize="sm" color={colors.textPrimary}>
            {rec.categoryName}
          </Text>
        </HStack>
        <HStack gap={1}>
          <Text fontSize="xs" color={priorityStyles.color}>
            {PRIORITY_CONFIG[rec.priority]?.emoji}
          </Text>
        </HStack>
      </Flex>

      {/* Budget Comparison with inline Apply */}
      <Flex
        gap={2}
        p={2}
        bg={isSelected ? priorityStyles.bg : colors.rowStripedBg}
        borderRadius="6px"
        fontSize="xs"
        align="center"
        flexWrap="wrap"
      >
        <Box flex="1" minW="60px">
          <Text color={colors.textMuted}>Current</Text>
          <Text fontWeight="600" color={rec.currentBudget === 0 ? colors.textMuted : colors.textPrimary}>
            {rec.currentBudget === 0 ? 'None' : formatCurrency(rec.currentBudget)}
          </Text>
        </Box>
        <Box flex="1" minW="60px">
          <Text color={colors.textMuted}>Next Month</Text>
          <Text fontWeight="600" color={rec.nextMonthBudget === null ? colors.textMuted : colors.info}>
            {rec.nextMonthBudget === null ? 'Not set' : formatCurrency(rec.nextMonthBudget)}
          </Text>
        </Box>
        <Box flex="1" minW="60px">
          <Text color={colors.textMuted}>Avg Spent</Text>
          <Text fontWeight="600" color={colors.textPrimary}>
            {formatCurrency(rec.avgSpending)}
          </Text>
        </Box>
        <Box flex="1" minW="60px">
          <Text color={colors.textMuted}>Suggested</Text>
          <Text fontWeight="700" color={colors.success}>
            {formatCurrency(rec.suggestedBudget)}
          </Text>
        </Box>
        {/* Subtle inline Apply */}
        <Button
          size="xs"
          variant="ghost"
          color={colors.textMuted}
          borderRadius="5px"
          fontWeight="500"
          onClick={(e) => {
            e.stopPropagation();
            onApply(rec);
          }}
          loading={isApplying}
          loadingText="..."
          px={2}
          h="24px"
          minW="auto"
          fontSize="xs"
          _hover={{ bg: colors.successBg, color: colors.success }}
        >
          Apply
        </Button>
      </Flex>
    </Box>
  );
};

// Compact Savings Card - Shows remaining budget available to save (grid-friendly)
const SavingsCard = ({ opp, colors, onDismiss, formatCurrency, isSelected, onToggleSelect }) => {
  const percentLeft = opp.currentBudget > 0
    ? Math.round((opp.availableToSave / opp.currentBudget) * 100)
    : 0;

  return (
    <Box
      p={2.5}
      bg={colors.cardBg}
      borderRadius="8px"
      border="2px solid"
      borderColor={isSelected ? colors.successBorder : colors.borderSubtle}
      position="relative"
      cursor="pointer"
      onClick={() => onToggleSelect(opp.categoryId)}
      _hover={{ borderColor: colors.successBorder }}
      transition="all 0.15s ease"
      opacity={isSelected ? 1 : 0.85}
      _active={{ transform: 'scale(0.98)' }}
    >
      {/* Selection Indicator */}
      <Box
        position="absolute"
        top={1.5}
        left={1.5}
        w="16px"
        h="16px"
        borderRadius="4px"
        border="2px solid"
        borderColor={isSelected ? colors.success : colors.borderStrong}
        bg={isSelected ? colors.success : 'transparent'}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {isSelected && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </Box>

      {/* Dismiss */}
      <Box
        position="absolute"
        top={1.5}
        right={1.5}
        p={0.5}
        borderRadius="full"
        cursor="pointer"
        color={colors.textMuted}
        opacity={0.5}
        _hover={{ opacity: 1, bg: colors.rowHoverBg }}
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(`savings-${opp.categoryId}`);
        }}
      >
        <XIcon />
      </Box>

      {/* Header - Category name and badge */}
      <Flex justify="space-between" align="center" mb={2} pl={5} pr={4}>
        <HStack gap={1.5}>
          <Text fontSize="sm">💰</Text>
          <Text fontWeight="600" fontSize="xs" color={colors.textPrimary} noOfLines={1}>
            {opp.categoryName}
          </Text>
        </HStack>
        <Box
          px={1.5}
          py={0.5}
          borderRadius="4px"
          bg={colors.successBg}
          fontSize="2xs"
          color={colors.success}
          fontWeight="600"
          flexShrink={0}
        >
          {percentLeft}% left
        </Box>
      </Flex>

      {/* Compact Stats Row */}
      <Flex gap={2} fontSize="2xs" mb={2}>
        <Box flex="1" textAlign="center">
          <Text color={colors.textMuted}>Budget</Text>
          <Text fontWeight="600" color={colors.textPrimary}>{formatCurrency(opp.currentBudget)}</Text>
        </Box>
        <Box flex="1" textAlign="center">
          <Text color={colors.textMuted}>Spent</Text>
          <Text fontWeight="600" color={colors.textPrimary}>{formatCurrency(opp.spent)}</Text>
        </Box>
      </Flex>

      {/* Available to Save - Highlighted */}
      <Box
        p={1.5}
        bg={colors.successBg}
        borderRadius="5px"
        textAlign="center"
        border={isSelected ? '1px solid' : 'none'}
        borderColor={colors.successBorder}
      >
        <Text fontSize="2xs" color={colors.success} fontWeight="500">Available to save</Text>
        <Text fontSize="sm" fontWeight="700" color={colors.success}>{formatCurrency(opp.availableToSave)}</Text>
      </Box>
    </Box>
  );
};

// Collapsible Section
const CollapsibleSection = ({
  title,
  icon: Icon,
  count,
  isOpen,
  onToggle,
  children,
  colors,
  accentColor,
  description
}) => (
  <Box
    borderRadius="10px"
    border="1px solid"
    borderColor={colors.borderSubtle}
    overflow="hidden"
    bg={colors.cardBg}
  >
    <Flex
      p={3}
      justify="space-between"
      align="center"
      cursor="pointer"
      onClick={onToggle}
      _hover={{ bg: colors.rowHoverBg }}
      transition="background 0.15s ease"
    >
      <HStack gap={2}>
        <Box color={accentColor}>
          <Icon />
        </Box>
        <Text fontWeight="600" fontSize="sm" color={colors.textPrimary}>
          {title}
        </Text>
        <Box
          px={2}
          py={0.5}
          borderRadius="full"
          bg={accentColor + '20'}
          minW="24px"
          textAlign="center"
        >
          <Text fontSize="xs" fontWeight="600" color={accentColor}>
            {count}
          </Text>
        </Box>
      </HStack>
      <Box color={colors.textMuted}>
        <ChevronIcon isOpen={isOpen} size={16} />
      </Box>
    </Flex>

    <Collapsible.Root open={isOpen}>
      <Collapsible.Content>
        <Box px={3} pb={3}>
          {description && (
            <Text fontSize="xs" color={colors.textMuted} mb={3}>
              {description}
            </Text>
          )}
          {children}
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  </Box>
);

// Priority Group within Section
const PriorityGroup = ({ priority, items, colors, renderItem }) => {
  const config = PRIORITY_CONFIG[priority];
  if (!items || items.length === 0) return null;

  return (
    <Box mb={3}>
      <HStack gap={1} mb={2}>
        <Text fontSize="xs" color={colors.textMuted}>
          {config.emoji} {config.label} Priority
        </Text>
        <Text fontSize="xs" color={colors.textMuted}>
          ({items.length})
        </Text>
      </HStack>
      <VStack gap={2} align="stretch">
        {items.map(renderItem)}
      </VStack>
    </Box>
  );
};

export default function BudgetRecommendations({
  budgetId,
  selectedMonth, // Format: "YYYY-MM"
  onApplySuggestion,
  onRefresh,
}) {
  const colors = useDarkModeColors();
  const { session } = useAuth();

  // State
  const [isMainOpen, setIsMainOpen] = useState(true);
  const [isAdjustOpen, setIsAdjustOpen] = useState(true);
  const [isSavingsOpen, setIsSavingsOpen] = useState(false); // Collapsed by default
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [loadingDismissed, setLoadingDismissed] = useState(true);
  const [applyingId, setApplyingId] = useState(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [selectedSavings, setSelectedSavings] = useState(new Set());
  const [selectedRecommendations, setSelectedRecommendations] = useState(new Set());

  // Get current month in YYYY-MM format
  const getCurrentMonth = () => {
    if (selectedMonth) return selectedMonth;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Fetch dismissed suggestions from database
  const fetchDismissedSuggestions = async () => {
    if (!session?.access_token) return;

    const month = getCurrentMonth();
    try {
      const response = await fetch(
        `/.netlify/functions/dismissed-suggestions?month=${month}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setDismissedIds(new Set(result.dismissed || []));
      }
    } catch (err) {
      console.error('Failed to fetch dismissed suggestions:', err);
      // Don't block UI if this fails - just show all suggestions
    } finally {
      setLoadingDismissed(false);
    }
  };

  const fetchRecommendations = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError('');
    try {
      // Build URL with optional month parameter
      const url = selectedMonth
        ? `/.netlify/functions/budget-recommendations?month=${selectedMonth}`
        : '/.netlify/functions/budget-recommendations';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch recommendations');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load dismissed suggestions and recommendations
  useEffect(() => {
    setLoadingDismissed(true);
    fetchDismissedSuggestions();
    fetchRecommendations();
  }, [session, budgetId, selectedMonth]);

  // Persist dismissal to database
  const handleDismiss = async (id, recommendation = null) => {
    // Immediately update UI
    setDismissedIds(prev => new Set([...prev, id]));

    // Persist to database
    if (session?.access_token) {
      const month = getCurrentMonth();
      const isSavings = id.startsWith('savings-');
      const categoryId = isSavings ? id.replace('savings-', '') : id;
      const suggestionType = isSavings ? 'savings' : 'recommendation';

      try {
        await fetch('/.netlify/functions/dismissed-suggestions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            categoryId,
            suggestionType,
            recommendationType: recommendation?.type || null,
            month,
          }),
        });
      } catch (err) {
        console.error('Failed to persist dismissal:', err);
        // UI already updated, so don't revert - it will persist next time
      }
    }
  };

  const handleApply = async (recommendation) => {
    setApplyingId(recommendation.categoryId);
    try {
      await onApplySuggestion(recommendation.categoryId, recommendation.suggestedBudget);
      handleDismiss(recommendation.categoryId, recommendation);
    } catch (err) {
      console.error('Failed to apply suggestion:', err);
    } finally {
      setApplyingId(null);
    }
  };

  const handleApplyAll = async () => {
    const visible = visibleRecommendations;
    if (visible.length === 0) return;

    setApplyingAll(true);
    try {
      for (const rec of visible) {
        await onApplySuggestion(rec.categoryId, rec.suggestedBudget);
        await handleDismiss(rec.categoryId, rec);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to apply all:', err);
    } finally {
      setApplyingAll(false);
    }
  };

  const handleRefresh = () => {
    fetchRecommendations();
    if (onRefresh) onRefresh();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Toggle savings card selection
  const handleToggleSavingsSelect = (categoryId) => {
    setSelectedSavings(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Clear all savings selections
  const handleClearSelection = () => {
    setSelectedSavings(new Set());
  };

  // Toggle recommendation card selection
  const handleToggleRecommendationSelect = (categoryId) => {
    setSelectedRecommendations(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Clear all recommendation selections
  const handleClearRecommendationSelection = () => {
    setSelectedRecommendations(new Set());
  };

  // Filter visible items
  const visibleRecommendations = (data?.recommendations || [])
    .filter(r => !dismissedIds.has(r.categoryId));

  const visibleSavings = (data?.savingsOpportunities || [])
    .filter(r => !dismissedIds.has(`savings-${r.categoryId}`));

  // Group recommendations by priority
  const groupedByPriority = {
    high: visibleRecommendations.filter(r => r.priority === 'high'),
    medium: visibleRecommendations.filter(r => r.priority === 'medium'),
    low: visibleRecommendations.filter(r => r.priority === 'low'),
  };

  const totalVisible = visibleRecommendations.length + visibleSavings.length;
  const hasHighPriority = groupedByPriority.high.length > 0;

  // Calculate summary stats dynamically from visible items (updates when items are dismissed)
  // Use suggestedBudget - currentBudget to match the adjustment calculation
  const visibleOverspending = visibleRecommendations
    .filter(r => r.type === 'underfunded')
    .reduce((sum, r) => sum + Math.max(0, r.suggestedBudget - r.currentBudget), 0);
  const visibleSavingsTotal = visibleSavings
    .reduce((sum, opp) => sum + opp.availableToSave, 0);

  return (
    <Box
      bg={colors.cardBg}
      borderRadius="12px"
      border="1px solid"
      borderColor={colors.borderSubtle}
      overflow="hidden"
      mb={4}
    >
      {/* Main Header */}
      <Flex
        p={3}
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={() => setIsMainOpen(!isMainOpen)}
        _hover={{ bg: colors.rowHoverBg }}
        transition="background 0.15s ease"
        borderBottom={isMainOpen ? '1px solid' : 'none'}
        borderColor={colors.borderSubtle}
      >
        {/* Left: Title */}
        <HStack gap={2} flexShrink={0}>
          <Box
            p={1.5}
            borderRadius="8px"
            bg="linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
            color="white"
            display={{ base: 'none', sm: 'block' }}
          >
            <LightbulbIcon />
          </Box>
          <Box>
            <Text fontWeight="600" fontSize="sm" color={colors.textPrimary} whiteSpace="nowrap">
              Suggestions
            </Text>
            <Text fontSize="xs" color={colors.textMuted}>
              {(loading || loadingDismissed) ? 'Analyzing...' : error ? 'Error loading' :
                totalVisible === 0 ? 'All good!' : `${totalVisible} suggestion${totalVisible !== 1 ? 's' : ''}`}
            </Text>
          </Box>
        </HStack>

        {/* Center: Summary Stats - Over budget / Available to save */}
        {!(loading || loadingDismissed) && !error && totalVisible > 0 && (
          <HStack gap={5} fontSize="xs" ml={4}>
            {visibleOverspending > 0 && (
              <VStack gap={0} align="center">
                <Text color={colors.textMuted} fontSize="2xs" whiteSpace="nowrap">Over budget</Text>
                <Text fontWeight="700" color={colors.danger} fontSize="sm">
                  {formatCurrency(visibleOverspending)}
                </Text>
              </VStack>
            )}
            {visibleSavingsTotal > 0 && (
              <VStack gap={0} align="center">
                <Text color={colors.textMuted} fontSize="2xs" whiteSpace="nowrap">Can save</Text>
                <Text fontWeight="700" color={colors.success} fontSize="sm">
                  {formatCurrency(visibleSavingsTotal)}
                </Text>
              </VStack>
            )}
          </HStack>
        )}

        {/* Right: Quick Stats Badges - Hidden on mobile to prevent overlap */}
        <HStack gap={2}>
          {!(loading || loadingDismissed) && !error && totalVisible > 0 && (
            <HStack gap={1} display={{ base: 'none', md: 'flex' }}>
              {visibleRecommendations.length > 0 && (
                <Box
                  px={2}
                  py={0.5}
                  borderRadius="full"
                  bg={hasHighPriority ? colors.dangerBg : colors.warningBg}
                  border="1px solid"
                  borderColor={hasHighPriority ? colors.dangerBorder : colors.warningBorder}
                >
                  <Text fontSize="xs" fontWeight="600" color={hasHighPriority ? colors.danger : colors.warning}>
                    {visibleRecommendations.length} adjust
                  </Text>
                </Box>
              )}
              {visibleSavings.length > 0 && (
                <Box
                  px={2}
                  py={0.5}
                  borderRadius="full"
                  bg={colors.successBg}
                  border="1px solid"
                  borderColor={colors.successBorder}
                >
                  <Text fontSize="xs" fontWeight="600" color={colors.success}>
                    {visibleSavings.length} save
                  </Text>
                </Box>
              )}
            </HStack>
          )}
          <Box color={colors.textMuted}>
            <ChevronIcon isOpen={isMainOpen} />
          </Box>
        </HStack>
      </Flex>

      {/* Collapsible Main Content */}
      <Collapsible.Root open={isMainOpen}>
        <Collapsible.Content>
          <Box p={3}>
            {(loading || loadingDismissed) ? (
              <Flex justify="center" py={6}>
                <VStack gap={2}>
                  <Spinner size="md" color="orange.500" />
                  <Text fontSize="xs" color={colors.textMuted}>
                    Analyzing 6 months of data...
                  </Text>
                </VStack>
              </Flex>
            ) : error ? (
              <Flex direction="column" align="center" py={4} gap={2}>
                <Text fontSize="sm" color={colors.danger}>{error}</Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleRefresh}
                  borderColor={colors.borderColor}
                  color={colors.textSecondary}
                >
                  <HStack gap={1}>
                    <RefreshIcon />
                    <Text>Retry</Text>
                  </HStack>
                </Button>
              </Flex>
            ) : totalVisible === 0 ? (
              <Flex direction="column" align="center" py={4} gap={2}>
                <Box
                  p={2}
                  borderRadius="full"
                  bg={colors.successBg}
                  color={colors.success}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </Box>
                <Text fontWeight="600" fontSize="sm" color={colors.textPrimary}>
                  Budget looks great!
                </Text>
                <Text fontSize="xs" color={colors.textMuted}>
                  {data?.summary?.categoriesAnalyzed || 0} categories analyzed
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  color={colors.textMuted}
                  onClick={handleRefresh}
                  mt={1}
                >
                  <HStack gap={1}>
                    <RefreshIcon />
                    <Text>Refresh</Text>
                  </HStack>
                </Button>
              </Flex>
            ) : (
              <VStack gap={3} align="stretch">
                {/* Adjust Budget Section */}
                {visibleRecommendations.length > 0 && (
                  <CollapsibleSection
                    title="Adjust Budget"
                    icon={AdjustIcon}
                    count={visibleRecommendations.length}
                    isOpen={isAdjustOpen}
                    onToggle={() => setIsAdjustOpen(!isAdjustOpen)}
                    colors={colors}
                    accentColor={hasHighPriority ? colors.danger : colors.warning}
                    description="Apply to next month's budget"
                  >
                    {/* Selection Summary Bar */}
                    {selectedRecommendations.size > 0 && (
                      <Flex
                        mb={3}
                        p={2.5}
                        bg={colors.warningBg}
                        borderRadius="8px"
                        border="1px solid"
                        borderColor={colors.warningBorder}
                        justify="space-between"
                        align="center"
                      >
                        <HStack gap={3}>
                          <Text fontSize="sm" fontWeight="600" color={colors.warning}>
                            {selectedRecommendations.size} selected
                          </Text>
                          <Box w="1px" h="16px" bg={colors.warningBorder} />
                          <HStack gap={1}>
                            <Text fontSize="sm" color={colors.textSecondary}>Adjustment:</Text>
                            <Text fontSize="lg" fontWeight="700" color={
                              visibleRecommendations
                                .filter(rec => selectedRecommendations.has(rec.categoryId))
                                .reduce((sum, rec) => sum + (rec.suggestedBudget - rec.currentBudget), 0) >= 0
                                ? colors.danger
                                : colors.success
                            }>
                              {(() => {
                                const total = visibleRecommendations
                                  .filter(rec => selectedRecommendations.has(rec.categoryId))
                                  .reduce((sum, rec) => sum + (rec.suggestedBudget - rec.currentBudget), 0);
                                return (total >= 0 ? '+' : '') + formatCurrency(total);
                              })()}
                            </Text>
                          </HStack>
                        </HStack>
                        <Button
                          size="xs"
                          variant="ghost"
                          color={colors.textMuted}
                          onClick={handleClearRecommendationSelection}
                          _hover={{ color: colors.textSecondary }}
                        >
                          Clear
                        </Button>
                      </Flex>
                    )}

                    {/* High Priority */}
                    <PriorityGroup
                      priority="high"
                      items={groupedByPriority.high}
                      colors={colors}
                      renderItem={(rec) => (
                        <RecommendationCard
                          key={rec.categoryId}
                          rec={rec}
                          colors={colors}
                          onApply={handleApply}
                          onDismiss={handleDismiss}
                          isApplying={applyingId === rec.categoryId}
                          formatCurrency={formatCurrency}
                          isSelected={selectedRecommendations.has(rec.categoryId)}
                          onToggleSelect={handleToggleRecommendationSelect}
                        />
                      )}
                    />

                    {/* Medium Priority */}
                    <PriorityGroup
                      priority="medium"
                      items={groupedByPriority.medium}
                      colors={colors}
                      renderItem={(rec) => (
                        <RecommendationCard
                          key={rec.categoryId}
                          rec={rec}
                          colors={colors}
                          onApply={handleApply}
                          onDismiss={handleDismiss}
                          isApplying={applyingId === rec.categoryId}
                          formatCurrency={formatCurrency}
                          isSelected={selectedRecommendations.has(rec.categoryId)}
                          onToggleSelect={handleToggleRecommendationSelect}
                        />
                      )}
                    />

                    {/* Low Priority */}
                    <PriorityGroup
                      priority="low"
                      items={groupedByPriority.low}
                      colors={colors}
                      renderItem={(rec) => (
                        <RecommendationCard
                          key={rec.categoryId}
                          rec={rec}
                          colors={colors}
                          onApply={handleApply}
                          onDismiss={handleDismiss}
                          isApplying={applyingId === rec.categoryId}
                          formatCurrency={formatCurrency}
                          isSelected={selectedRecommendations.has(rec.categoryId)}
                          onToggleSelect={handleToggleRecommendationSelect}
                        />
                      )}
                    />

                    {/* Apply All - subtle link style */}
                    {visibleRecommendations.length > 1 && (
                      <Flex justify="flex-end" mt={1}>
                        <Button
                          size="xs"
                          variant="ghost"
                          color={colors.textMuted}
                          fontWeight="500"
                          onClick={handleApplyAll}
                          loading={applyingAll}
                          loadingText="..."
                          _hover={{ color: colors.info }}
                          px={2}
                          h="24px"
                        >
                          Apply all for next month
                        </Button>
                      </Flex>
                    )}
                  </CollapsibleSection>
                )}

                {/* Potential Savings Section */}
                {visibleSavings.length > 0 && (
                  <CollapsibleSection
                    title="Potential Savings"
                    icon={SavingsIcon}
                    count={visibleSavings.length}
                    isOpen={isSavingsOpen}
                    onToggle={() => setIsSavingsOpen(!isSavingsOpen)}
                    colors={colors}
                    accentColor={colors.success}
                    description="Discretionary categories (no recurring) with money left to save"
                  >
                    {/* Selection Summary Bar */}
                    {selectedSavings.size > 0 && (
                      <Flex
                        mb={3}
                        p={2.5}
                        bg={colors.successBg}
                        borderRadius="8px"
                        border="1px solid"
                        borderColor={colors.successBorder}
                        justify="space-between"
                        align="center"
                      >
                        <HStack gap={3}>
                          <Text fontSize="sm" fontWeight="600" color={colors.success}>
                            {selectedSavings.size} selected
                          </Text>
                          <Box w="1px" h="16px" bg={colors.successBorder} />
                          <HStack gap={1}>
                            <Text fontSize="sm" color={colors.textSecondary}>Total:</Text>
                            <Text fontSize="lg" fontWeight="700" color={colors.success}>
                              {formatCurrency(
                                visibleSavings
                                  .filter(opp => selectedSavings.has(opp.categoryId))
                                  .reduce((sum, opp) => sum + opp.availableToSave, 0)
                              )}
                            </Text>
                          </HStack>
                        </HStack>
                        <Button
                          size="xs"
                          variant="ghost"
                          color={colors.textMuted}
                          onClick={handleClearSelection}
                          _hover={{ color: colors.textSecondary }}
                        >
                          Clear
                        </Button>
                      </Flex>
                    )}
                    <Grid
                      templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }}
                      gap={2}
                    >
                      {visibleSavings.map((opp) => (
                        <SavingsCard
                          key={`savings-${opp.categoryId}`}
                          opp={opp}
                          colors={colors}
                          onDismiss={handleDismiss}
                          formatCurrency={formatCurrency}
                          isSelected={selectedSavings.has(opp.categoryId)}
                          onToggleSelect={handleToggleSavingsSelect}
                        />
                      ))}
                    </Grid>
                  </CollapsibleSection>
                )}

                {/* Refresh Button */}
                <Flex justify="center" pt={1}>
                  <Button
                    size="xs"
                    variant="ghost"
                    color={colors.textMuted}
                    onClick={handleRefresh}
                    _hover={{ color: colors.textSecondary }}
                  >
                    <HStack gap={1}>
                      <RefreshIcon />
                      <Text>Refresh Analysis</Text>
                    </HStack>
                  </Button>
                </Flex>
              </VStack>
            )}
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}
