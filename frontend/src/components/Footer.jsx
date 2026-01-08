import { Box, Flex, Text } from '@chakra-ui/react'
import { useColorModeValue } from './ui/color-mode'

function Footer() {
  const bgColor = useColorModeValue('#18181B', '#09090B')
  const borderColor = useColorModeValue('#27272A', '#18181B')
  const mutedColor = useColorModeValue('#A1A1AA', '#71717A')

  return (
    <Box as="footer" bg={bgColor} borderTop="1px solid" borderColor={borderColor} color="white" w="100%">
      <Flex
        maxW="1200px"
        mx="auto"
        px={8}
        py={4}
        justify="space-between"
        align="center"
        flexWrap="wrap"
        gap={4}
      >
        <Flex align="center" gap={2}>
          <Text fontSize="xl">💰</Text>
          <Text fontSize="md" fontWeight="bold">
            BudgetWise
          </Text>
          <Text color={mutedColor} fontSize="sm" ml={2}>
            A simple, effective budget tracking tool.
          </Text>
        </Flex>

        <Text color={mutedColor} fontSize="sm">
          &copy; 2025 BudgetWise. All rights reserved.
        </Text>
      </Flex>
    </Box>
  )
}

export default Footer
