import { Box, Flex, Text } from '@chakra-ui/react'

function Footer() {
  return (
    <Box as="footer" bg="gray.800" color="white" w="100%" py={4} px={8}>
      <Flex
        w="100%"
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
          <Text color="gray.400" fontSize="sm" ml={2}>
            A simple, effective budget tracking tool.
          </Text>
        </Flex>

        <Text color="gray.400" fontSize="sm">
          &copy; 2025 BudgetWise. All rights reserved.
        </Text>
      </Flex>
    </Box>
  )
}

export default Footer
