import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Flex, HStack } from '@chakra-ui/react';
import { useDarkModeColors } from '../lib/useDarkModeColors';

const TABS = [
  { label: 'Preferences', to: '/settings' },
  { label: 'Import', to: '/import' },
  { label: 'Categories', to: '/categories' },
];

/**
 * Tab bar shared by the pages grouped under Settings.
 *
 * Each tab keeps its own route, so existing /import and /categories links (and
 * browser history) still work — the tabs are navigation, not local state.
 * Rendered above each page's own PageContainer, so it matches their horizontal
 * rhythm manually.
 */
export default function SettingsTabs() {
  const location = useLocation();
  const colors = useDarkModeColors();

  return (
    <Box w="100%" bg={colors.pageBg} pt={{ base: 6, md: 8 }}>
      <Box maxW="1200px" mx="auto" px={{ base: 4, md: 8 }} w="100%">
        <Flex
          p={1}
          bg={colors.cardBg}
          borderRadius="12px"
          border="1px solid"
          borderColor={colors.borderSubtle}
          w="fit-content"
          maxW="100%"
          overflowX="auto"
        >
          <HStack gap={1}>
            {TABS.map((tab) => {
              const isActive = location.pathname === tab.to;
              return (
                <Box
                  key={tab.to}
                  as={RouterLink}
                  to={tab.to}
                  px={{ base: 4, md: 5 }}
                  py={2}
                  borderRadius="8px"
                  fontSize="sm"
                  fontWeight="600"
                  whiteSpace="nowrap"
                  color={isActive ? 'white' : colors.textSecondary}
                  bg={isActive ? 'linear-gradient(135deg, #1E293B 0%, #334155 100%)' : 'transparent'}
                  _hover={{ bg: isActive ? undefined : colors.rowStripedBg }}
                  transition="all 0.15s"
                >
                  {tab.label}
                </Box>
              );
            })}
          </HStack>
        </Flex>
      </Box>
    </Box>
  );
}
