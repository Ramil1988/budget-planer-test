import { Box } from '@chakra-ui/react';
import { useColorModeValue } from './ui/color-mode';

/**
 * PageContainer - Consistent layout wrapper for all app pages
 * Provides consistent max-width, padding, and background
 *
 * Usage:
 * <PageContainer>
 *   <YourPageContent />
 * </PageContainer>
 */
export default function PageContainer({ children, maxW = '1200px', ...props }) {
  const bgColor = useColorModeValue('#FAFAF9', '#09090B');

  return (
    <Box w="100%" minH="calc(100vh - 130px)" bg={bgColor} overflowX="hidden">
      <Box
        maxW={maxW}
        mx="auto"
        px={{ base: 4, md: 8 }}
        py={{ base: 6, md: 8 }}
        w="100%"
        {...props}
      >
        {children}
      </Box>
    </Box>
  );
}
