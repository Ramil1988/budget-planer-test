import { Box } from '@chakra-ui/react';

/**
 * PageContainer - Consistent layout wrapper for all app pages
 * Provides consistent max-width, padding, and background
 *
 * Usage:
 * <PageContainer>
 *   <YourPageContent />
 * </PageContainer>
 */
export default function PageContainer({ children, bg = '#FAFAF9', maxW = '1200px', ...props }) {
  return (
    <Box w="100%" minH="calc(100vh - 130px)" bg={bg}>
      <Box
        maxW={maxW}
        mx="auto"
        px={{ base: 4, md: 8 }}
        py={{ base: 6, md: 8 }}
        {...props}
      >
        {children}
      </Box>
    </Box>
  );
}
