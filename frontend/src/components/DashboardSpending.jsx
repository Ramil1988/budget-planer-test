import { useId, useState } from 'react';
import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import { FiArrowUpRight, FiChevronDown } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';

const DISPLAY_LIMIT = 5;
const GROUP_COLOR = '#9CA3AF';

function SpendingDonut({ rows, total, formatCurrency, activeRow, setActiveKey }) {
  const center = 84;
  const radius = 74;
  let offset = 0;
  const arcs = rows.map((row) => {
    const length = Math.max(0, Math.min(row.share, 100 - offset));
    const arc = { ...row, offset, length };
    offset += length;
    return arc;
  });
  const amount = formatCurrency(activeRow?.spent ?? total);

  return (
    <Box position="relative" flexShrink={0} w="168px" maxW="100%" aspectRatio="1">
      <svg viewBox="0 0 168 168" width="100%" height="100%" aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--dashboard-muted-surface)"
          strokeWidth="15"
        />
        <g transform="rotate(-90 84 84)">
          {arcs.filter(({ length }) => length > 0).map((arc) => {
            const highlighted = activeRow?.key === arc.key;
            const gap = arc.length < 100 ? Math.min(1, arc.length / 3) : 0;

            return (
              <circle
                key={arc.key}
                cx={center}
                cy={center}
                r={radius}
                pathLength="100"
                fill="none"
                stroke={arc.color}
                strokeWidth={highlighted ? 18 : 15}
                strokeDasharray={`${arc.length - gap} ${100 - arc.length + gap}`}
                strokeDashoffset={-arc.offset - gap / 2}
                opacity={activeRow && !highlighted ? 0.3 : 1}
                onPointerEnter={(event) => { if (event.pointerType === 'mouse') setActiveKey(arc.key); }}
                onPointerLeave={(event) => { if (event.pointerType === 'mouse') setActiveKey(null); }}
              />
            );
          })}
        </g>
      </svg>
      <Flex
        pointerEvents="none"
        position="absolute"
        inset="0"
        align="center"
        justify="center"
        direction="column"
        gap={0.5}
        textAlign="center"
        px="24px"
        minW="0"
      >
        <Text
          fontSize="xs"
          fontWeight="600"
          color="var(--dashboard-muted)"
          lineClamp={2}
          overflowWrap="anywhere"
        >
          {activeRow?.name ?? 'Total Spent'}
        </Text>
        <Text
          fontSize={`min(20px, ${188 / amount.length}px)`}
          lineHeight="1.15"
          fontWeight="800"
          color="var(--dashboard-ink)"
          fontVariantNumeric="tabular-nums"
          letterSpacing="-0.035em"
        >
          {amount}
        </Text>
        {activeRow && (
          <Text color="var(--dashboard-muted)" fontSize="xs" fontVariantNumeric="tabular-nums">
            {activeRow.share.toFixed(0)}%
          </Text>
        )}
      </Flex>
    </Box>
  );
}

export default function DashboardSpending({ categories, total, formatCurrency }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [othersExpanded, setOthersExpanded] = useState(false);
  const headingId = useId();
  const othersId = useId();
  const others = categories.slice(DISPLAY_LIMIT).filter(({ spent }) => spent > 0);
  const topCategories = categories.slice(0, DISPLAY_LIMIT).map((category) => ({
    ...category,
    key: `category:${category.id}`,
  }));
  const chartCategories = others.length > 0
    ? [
        ...topCategories,
        {
          key: 'group:others',
          name: 'Others',
          spent: others.reduce((sum, category) => sum + category.spent, 0),
          color: GROUP_COLOR,
          grouped: true,
        },
      ]
    : topCategories;
  const rows = chartCategories.map((category) => ({
    ...category,
    share: total > 0 ? (category.spent / total) * 100 : 0,
  }));
  const activeRow = rows.find(({ key }) => key === (hoveredKey ?? selectedKey));

  return (
    <Box as="section" className="dashboard-panel" aria-labelledby={headingId} minW="0">
      <Flex justify="space-between" align="center" gap={2} mb={4}>
        <Heading
          as="h2"
          id={headingId}
          fontSize={{ base: 'lg', md: 'xl' }}
          lineHeight="1.2"
          letterSpacing="-0.035em"
          color="var(--dashboard-ink)"
        >
          Spending Breakdown
        </Heading>
        <Flex
          as={RouterLink}
          to="/budget"
          align="center"
          gap={1}
          flexShrink={0}
          minH={{ base: '44px', md: '36px' }}
          px={2}
          borderRadius="6px"
          color="var(--dashboard-accent)"
          fontSize="sm"
          fontWeight="700"
          _hover={{ bg: 'var(--dashboard-hover)' }}
          _focusVisible={{ outline: '2px solid var(--dashboard-accent)', outlineOffset: '2px' }}
        >
          Details <FiArrowUpRight aria-hidden="true" />
        </Flex>
      </Flex>

      {rows.length > 0 ? (
        <Flex direction={{ base: 'column', md: 'row' }} align="center" gap={{ base: 3, lg: 5 }}>
          <SpendingDonut
            rows={rows}
            total={total}
            activeRow={activeRow}
            setActiveKey={setHoveredKey}
            formatCurrency={formatCurrency}
          />
          <Box as="ul" listStyle="none" flex="1" w="100%" minW="0" m={0} p={0}>
            {rows.map((row) => {
              const highlighted = activeRow?.key === row.key || (row.grouped && othersExpanded);
              const share = Math.max(0, Math.min(row.share, 100));

              return (
                <Box as="li" key={row.key}>
                  <Box
                    as="button"
                    type="button"
                    aria-expanded={row.grouped ? othersExpanded : undefined}
                    aria-controls={row.grouped ? othersId : undefined}
                    aria-pressed={!row.grouped ? selectedKey === row.key : undefined}
                    onClick={row.grouped ? () => setOthersExpanded((expanded) => !expanded)
                      : () => setSelectedKey((current) => current === row.key ? null : row.key)}
                    onFocus={row.grouped ? () => setHoveredKey(row.key) : undefined}
                    onBlur={row.grouped ? () => setHoveredKey(null) : undefined}
                    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHoveredKey(row.key); }}
                    onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHoveredKey(null); }}
                    w="100%"
                    minH={{ base: '44px', md: '0' }}
                    py={1.5}
                    px={1.5}
                    borderRadius="6px"
                    textAlign="start"
                    cursor="pointer"
                    bg={highlighted ? 'var(--dashboard-hover)' : undefined}
                    _focusVisible={{ outline: '2px solid var(--dashboard-accent)', outlineOffset: '2px' }}
                  >
                    <Flex as="span" align="center" gap={2} mb={1} minW="0">
                      <Box as="span" aria-hidden="true" w="7px" h="7px" borderRadius="full" bg={row.color} flexShrink={0} />
                      <Text as="span" flex="1" minW="0" truncate title={row.name} fontSize="sm" fontWeight="600" color="var(--dashboard-ink)">
                        {row.name}
                      </Text>
                      {row.grouped && (
                        <Box as="span" aria-hidden="true" color="var(--dashboard-muted)" transform={othersExpanded ? 'rotate(180deg)' : undefined}>
                          <FiChevronDown />
                        </Box>
                      )}
                      <Text as="span" fontSize="sm" fontWeight="700" fontVariantNumeric="tabular-nums" color="var(--dashboard-ink)" whiteSpace="nowrap">
                        {formatCurrency(row.spent)}
                      </Text>
                      <Text as="span" flexShrink={0} minW="4ch" textAlign="end" fontSize="xs" fontVariantNumeric="tabular-nums" color="var(--dashboard-muted)">
                        {row.share.toFixed(0)}%
                      </Text>
                    </Flex>
                    <Box as="span" aria-hidden="true" display="block" h="3px" borderRadius="full" overflow="hidden" bg="var(--dashboard-muted-surface)">
                      <Box as="span" display="block" w={`${share}%`} h="100%" borderRadius="full" bg={row.color} />
                    </Box>
                  </Box>
                  {row.grouped && (
                    <Box
                      as="ul"
                      id={othersId}
                      hidden={!othersExpanded}
                      listStyle="none"
                      m={0}
                      mt={1}
                      pl={3}
                      pr={1.5}
                      py={1}
                      borderLeftWidth="1px"
                      borderColor="var(--dashboard-border)"
                    >
                      {others.map((category) => (
                        <Flex as="li" key={category.id} align="center" gap={1.5} py={1}>
                          <Box as="span" aria-hidden="true" w="5px" h="5px" borderRadius="full" bg={category.color} flexShrink={0} />
                          <Text flex="1" minW="0" truncate title={category.name} fontSize="xs" color="var(--dashboard-muted)">{category.name}</Text>
                          <Text fontSize="xs" fontWeight="600" fontVariantNumeric="tabular-nums" color="var(--dashboard-ink)">{formatCurrency(category.spent)}</Text>
                        </Flex>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Flex>
      ) : (
        <Flex minH="168px" align="center" justify="center" py={4}>
          <Text textAlign="center" fontSize="sm" color="var(--dashboard-muted)">
            {total > 0 ? 'No categorized spending this month' : 'No spending this month'}
          </Text>
        </Flex>
      )}
    </Box>
  );
}
