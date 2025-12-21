import { Box, Container, Flex, Text, VStack } from '@chakra-ui/react'

function Footer() {
  return (
    <Box as="footer" bg="gray.800" color="white" w="100%">
      <Container maxW="1200px" px={8}>
        <Flex
          justify="space-between"
          align="flex-start"
          gap={16}
          py={16}
          flexWrap="wrap"
        >
          <VStack align="flex-start" flex={3} minW="300px">
            <Flex align="center" gap={2}>
              <Text fontSize="2xl">💰</Text>
              <Text fontSize="xl" fontWeight="bold">
                BudgetWise
              </Text>
            </Flex>
            <Text color="gray.400" mt={4}>
              A simple, effective budget tracking tool.
            </Text>
          </VStack>
        </Flex>

        <Box
          textAlign="center"
          mt={16}
          pt={8}
          pb={16}
          color="gray.400"
          borderTop="1px"
          borderColor="gray.600"
        >
          <Text>&copy; 2025 BudgetWise. All rights reserved.</Text>
        </Box>
      </Container>
    </Box>
  )
}

export default Footer
