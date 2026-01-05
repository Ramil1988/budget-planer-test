import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  IconButton,
  SimpleGrid,
  VStack,
  HStack,
  Stack,
  Badge,
} from '@chakra-ui/react'

function Home() {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  // List of categories
  const categories = [
    'Afterschool', 'Autocredit', 'Clothes', 'Food', 'Food/Costco',
    'Fuel', 'Government Loan', 'Haircut', 'Household items/Car', 'Insurance',
    'Internet', 'Massage', 'Mobile/Internet', 'Mortgage', 'NB Power',
    'Pharmacy', 'Property tax', 'Subscriptions', 'Unexpected', 'Weekend'
  ]

  return (
    <Box as="main">
      {/* Hero Section */}
      <Container maxW="1200px" px={8} py={{ base: 16, md: 24 }}>
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          align="center"
          gap={12}
          justify="space-between"
        >
          {/* Left side - Text content */}
          <Box flex={1} maxW={{ base: '100%', lg: '500px' }}>
            <Heading
              as="h1"
              fontSize={{ base: '3xl', md: '4xl', lg: '5xl' }}
              fontWeight="normal"
              mb={6}
              lineHeight="1.2"
            >
              Smart{' '}
              <Text as="span" color="blue.600" fontWeight="bold">
                Budget Tracking
              </Text>{' '}
              with Auto-Categorization
            </Heading>
            <Text fontSize={{ base: 'md', md: 'lg' }} color="gray.600" mb={8} lineHeight="1.8">
              Import your bank transactions and let our smart categorization do the work.
              Track spending across categories, set monthly budgets, and manage your finances
              - all with automatic balance calculations.
            </Text>
            <HStack gap={4}>
              <Button
                as={RouterLink}
                to="/signup"
                bg="black"
                color="white"
                size="lg"
                px={8}
                py={6}
                fontSize="md"
                _hover={{
                  bg: 'gray.800',
                }}
              >
                Get Started Free
              </Button>
              <Button
                as="a"
                href="#features"
                variant="outline"
                size="lg"
                px={8}
                py={6}
                fontSize="md"
              >
                Learn More
              </Button>
            </HStack>
          </Box>

          {/* Right side - Image (hidden on mobile) */}
          <Box flex={1} maxW={{ base: '100%', lg: '600px' }} display={{ base: 'none', md: 'block' }}>
            <Box
              as="img"
              src="/images/hero-dashboard.png"
              alt="Budget dashboard preview"
              w="100%"
              h="auto"
              style={{ mixBlendMode: 'multiply' }}
            />
          </Box>
        </Flex>
      </Container>

      {/* Quick Features Section */}
      <Box bg="gray.50" py={{ base: 12, md: 16 }} id="features">
        <Container maxW="1200px" px={8}>
          <Heading
            as="h2"
            fontSize={{ base: '2xl', md: '3xl' }}
            textAlign="center"
            mb={4}
          >
            Why Choose BudgetWise?
          </Heading>
          <Text
            fontSize="lg"
            color="gray.600"
            textAlign="center"
            mb={10}
            maxW="600px"
            mx="auto"
          >
            Built for real-world budgeting with features that actually save you time.
          </Text>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
            <VStack
              bg="white"
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
            >
              <Box fontSize="2xl">🏷️</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold">
                Smart Auto-Categorization
              </Heading>
              <Text color="gray.600" fontSize="sm">
                Merchant patterns automatically categorize your transactions into budget categories.
              </Text>
            </VStack>

            <VStack
              bg="white"
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
            >
              <Box fontSize="2xl">📥</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold">
                Easy Transaction Import
              </Heading>
              <Text color="gray.600" fontSize="sm">
                Import from Google Sheets or CSV files with automatic merchant matching.
              </Text>
            </VStack>

            <VStack
              bg="white"
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
            >
              <Box fontSize="2xl">📊</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold">
                Monthly Budget Planning
              </Heading>
              <Text color="gray.600" fontSize="sm">
                Set spending limits per category and track your budget in real-time.
              </Text>
            </VStack>

            <VStack
              bg="white"
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
            >
              <Box fontSize="2xl">🧮</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold">
                Automatic Balance Tracking
              </Heading>
              <Text color="gray.600" fontSize="sm">
                Running balance calculated automatically for every transaction.
              </Text>
            </VStack>

            <VStack
              bg="white"
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
            >
              <Box fontSize="2xl">📅</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold">
                Month-by-Month View
              </Heading>
              <Text color="gray.600" fontSize="sm">
                Navigate between months to see historical spending and budget performance.
              </Text>
            </VStack>

            <VStack
              bg="white"
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
            >
              <Box fontSize="2xl">🔒</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold">
                Secure & Private
              </Heading>
              <Text color="gray.600" fontSize="sm">
                Row-level security ensures you only see your own data. Enterprise-grade encryption.
              </Text>
            </VStack>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Detailed Features Section */}
      <Container maxW="1200px" px={8} py={{ base: 12, md: 16 }}>
        <VStack gap={16} maxW="1000px" mx="auto">
          {/* Smart Auto-Categorization */}
          <Flex
            align="center"
            gap={12}
            direction={{ base: 'column', md: 'row' }}
            textAlign={{ base: 'center', md: 'left' }}
          >
            <VStack flex={1} align={{ base: 'center', md: 'flex-start' }} gap={4}>
              <Heading as="h2" size="lg">
                🏷️ Smart Auto-Categorization
              </Heading>
              <Text color="gray.600">
                Our system automatically matches your transaction descriptions to the right category. No more manual sorting.
              </Text>
              <Stack gap={2}>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>"COSTCO GAS W1345" → Fuel</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>"MCDONALD'S #404" → Weekend</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>"ROGERS WIRELESS" → Mobile/Internet</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Add your own merchant patterns</Text>
                </Flex>
              </Stack>
            </VStack>
            <Box flex={1}>
              <Box as="img" src="/images/visual.jpg" alt="Auto-categorization preview" w="100%" borderRadius="lg" style={{ mixBlendMode: 'multiply' }} />
            </Box>
          </Flex>

          {/* Transaction Import */}
          <Flex
            align="center"
            gap={12}
            direction={{ base: 'column', md: 'row-reverse' }}
            textAlign={{ base: 'center', md: 'left' }}
          >
            <VStack flex={1} align={{ base: 'center', md: 'flex-start' }} gap={4}>
              <Heading as="h2" size="lg">
                📥 Easy Transaction Import
              </Heading>
              <Text color="gray.600">
                Import transactions from Google Sheets or CSV files. Auto-sync keeps your data up to date.
              </Text>
              <Stack gap={2}>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Connect Google Sheets directly</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>CSV file upload support</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Auto-sync at configurable intervals</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Automatic duplicate detection</Text>
                </Flex>
              </Stack>
            </VStack>
            <Box flex={1}>
              <Box as="img" src="/images/OCR.jpg" alt="Transaction import feature" w="100%" borderRadius="lg" style={{ mixBlendMode: 'multiply' }} />
            </Box>
          </Flex>

          {/* Monthly Budget Planning */}
          <Flex
            align="center"
            gap={12}
            direction={{ base: 'column', md: 'row' }}
            textAlign={{ base: 'center', md: 'left' }}
          >
            <VStack flex={1} align={{ base: 'center', md: 'flex-start' }} gap={4}>
              <Heading as="h2" size="lg">
                📊 Monthly Budget Planning
              </Heading>
              <Text color="gray.600">
                Set a total monthly budget and allocate limits to each spending category. Track spending in real-time.
              </Text>
              <Stack gap={2}>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Set limits per category</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Visual progress bars</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Color-coded warnings (80%+, 100%+)</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Navigate to any month</Text>
                </Flex>
              </Stack>
            </VStack>
            <Box flex={1}>
              <Box as="img" src="/images/goal-tracking.png" alt="Monthly budget planning" w="100%" borderRadius="lg" style={{ mixBlendMode: 'multiply' }} />
            </Box>
          </Flex>
        </VStack>
      </Container>

      {/* Categories Section */}
      <Box bg="gray.50" py={12}>
        <Container maxW="1200px" px={8}>
          <Heading as="h2" size="lg" textAlign="center" mb={4}>
            Pre-Configured Categories
          </Heading>
          <Text color="gray.600" textAlign="center" mb={6} maxW="600px" mx="auto">
            Your account comes with expense categories ready to go. Add your own categories and merchant patterns anytime.
          </Text>
          <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} gap={3} maxW="900px" mx="auto">
            {categories.map((category) => (
              <Badge
                key={category}
                py={2}
                px={4}
                borderRadius="full"
                bg="white"
                color="gray.700"
                fontSize="sm"
                fontWeight="medium"
                textAlign="center"
                shadow="sm"
              >
                {category}
              </Badge>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Security Section */}
      <Box py={12}>
        <Container maxW="800px" px={8} textAlign="center">
          <Heading as="h2" size="lg" mb={4}>
            🔒 Enterprise-Grade Security
          </Heading>
          <Text color="gray.600" mb={6}>
            Built on Supabase with PostgreSQL. Row-level security ensures you only see your own data.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={6}>
            <VStack>
              <Text fontSize="xl">🛡️</Text>
              <Text fontWeight="semibold" fontSize="sm">Row-Level Security</Text>
              <Text color="gray.600" fontSize="xs">
                Database policies ensure data isolation
              </Text>
            </VStack>
            <VStack>
              <Text fontSize="xl">🔐</Text>
              <Text fontWeight="semibold" fontSize="sm">Encrypted Storage</Text>
              <Text color="gray.600" fontSize="xs">
                All data encrypted at rest
              </Text>
            </VStack>
            <VStack>
              <Text fontSize="xl">✅</Text>
              <Text fontWeight="semibold" fontSize="sm">Secure Auth</Text>
              <Text color="gray.600" fontSize="xs">
                Supabase Auth with JWT tokens
              </Text>
            </VStack>
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box bg="blue.600" color="white" py={12} textAlign="center">
        <Container maxW="1200px" px={8}>
          <Heading as="h2" size="lg" mb={2}>
            Ready to Take Control?
          </Heading>
          <Text opacity={0.9} mb={6}>
            Create your free account and start tracking your budget today.
          </Text>
          <Flex justify="center" gap={4} direction={{ base: 'column', sm: 'row' }}>
            <Button
              as={RouterLink}
              to="/signup"
              bg="white"
              color="blue.600"
              size="lg"
              _hover={{ bg: 'gray.100' }}
            >
              Get Started Free
            </Button>
            <Button
              as={RouterLink}
              to="/login"
              variant="outline"
              borderColor="white"
              color="white"
              size="lg"
              _hover={{ bg: 'blue.700' }}
            >
              Sign In
            </Button>
          </Flex>
        </Container>
      </Box>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <IconButton
          position="fixed"
          bottom={8}
          right={8}
          bg="blue.600"
          color="white"
          borderRadius="full"
          size="lg"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          _hover={{
            bg: 'blue.700',
          }}
          fontSize="xl"
        >
          ↑
        </IconButton>
      )}
    </Box>
  )
}

export default Home
