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
import { useDarkModeColors } from '../lib/useDarkModeColors'
import { useColorMode } from '../components/ui/color-mode'

function Home() {
  const colors = useDarkModeColors()
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
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
    <Box as="main" bg={colors.pageBg} color={colors.textPrimary}>
      {/* Hero Section */}
      <Container maxW="1200px" px={8} py={{ base: 16, md: 24 }}>
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          align="center"
          gap={12}
          justify="space-between"
        >
          {/* Left side - Text content */}
          <Box flex={1} maxW={{ base: '100%', lg: isDark ? '100%' : '500px' }} textAlign={{ base: 'center', lg: isDark ? 'center' : 'left' }}>
            <Heading
              as="h1"
              fontSize={{ base: '3xl', md: '4xl', lg: '5xl' }}
              fontWeight="normal"
              mb={6}
              lineHeight="1.2"
              color={colors.textPrimary}
            >
              <Text as="span" color={colors.textSecondary}>Smart</Text>{' '}
              <Text as="span" color="blue.500" fontWeight="bold">
                Budget Tracking
              </Text>{' '}
              <Text as="span" color={colors.textSecondary}>with Auto-Categorization</Text>
            </Heading>
            <Text fontSize={{ base: 'md', md: 'lg' }} color={colors.textSecondary} mb={8} lineHeight="1.8">
              Import your bank transactions and let our smart categorization do the work.
              Track spending across categories, set monthly budgets, and manage your finances
              - all with automatic balance calculations.
            </Text>
            <Stack direction={{ base: 'column', sm: 'row' }} gap={4} justify={{ base: 'center', lg: isDark ? 'center' : 'flex-start' }}>
              <Button
                as={RouterLink}
                to="/signup"
                bg="blue.600"
                color="white"
                size="lg"
                px={8}
                py={6}
                fontSize="md"
                _hover={{
                  bg: 'blue.700',
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
            </Stack>
          </Box>

          {/* Right side - Image (hidden on mobile and in dark mode) */}
          {!isDark && (
            <Box flex={1} maxW={{ base: '100%', lg: '600px' }} display={{ base: 'none', md: 'block' }}>
              <Box
                as="img"
                src="/images/hero-dashboard.png"
                alt="Budget dashboard preview"
                w="100%"
                h="auto"
                borderRadius="lg"
              />
            </Box>
          )}
        </Flex>
      </Container>

      {/* Quick Features Section */}
      <Box bg={colors.cardBg} py={{ base: 12, md: 16 }} id="features">
        <Container maxW="1200px" px={8}>
          <Heading
            as="h2"
            fontSize={{ base: '2xl', md: '3xl' }}
            textAlign="center"
            mb={4}
            color={colors.textPrimary}
          >
            Why Choose BudgetWise?
          </Heading>
          <Text
            fontSize="lg"
            color={colors.textSecondary}
            textAlign="center"
            mb={10}
            maxW="600px"
            mx="auto"
          >
            Built for real-world budgeting with features that actually save you time.
          </Text>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
            <VStack
              bg={colors.pageBg}
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
              border="1px solid"
              borderColor={colors.borderSubtle}
            >
              <Box fontSize="2xl">🏷️</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold" color={colors.textPrimary}>
                Smart Auto-Categorization
              </Heading>
              <Text color={colors.textSecondary} fontSize="sm">
                Merchant patterns automatically categorize your transactions into budget categories.
              </Text>
            </VStack>

            <VStack
              bg={colors.pageBg}
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
              border="1px solid"
              borderColor={colors.borderSubtle}
            >
              <Box fontSize="2xl">📥</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold" color={colors.textPrimary}>
                Easy Transaction Import
              </Heading>
              <Text color={colors.textSecondary} fontSize="sm">
                Import from Google Sheets or CSV files with automatic merchant matching.
              </Text>
            </VStack>

            <VStack
              bg={colors.pageBg}
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
              border="1px solid"
              borderColor={colors.borderSubtle}
            >
              <Box fontSize="2xl">📊</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold" color={colors.textPrimary}>
                Monthly Budget Planning
              </Heading>
              <Text color={colors.textSecondary} fontSize="sm">
                Set spending limits per category and track your budget in real-time.
              </Text>
            </VStack>

            <VStack
              bg={colors.pageBg}
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
              border="1px solid"
              borderColor={colors.borderSubtle}
            >
              <Box fontSize="2xl">🧮</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold" color={colors.textPrimary}>
                Automatic Balance Tracking
              </Heading>
              <Text color={colors.textSecondary} fontSize="sm">
                Running balance calculated automatically for every transaction.
              </Text>
            </VStack>

            <VStack
              bg={colors.pageBg}
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
              border="1px solid"
              borderColor={colors.borderSubtle}
            >
              <Box fontSize="2xl">📅</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold" color={colors.textPrimary}>
                Month-by-Month View
              </Heading>
              <Text color={colors.textSecondary} fontSize="sm">
                Navigate between months to see historical spending and budget performance.
              </Text>
            </VStack>

            <VStack
              bg={colors.pageBg}
              p={6}
              borderRadius="lg"
              align="flex-start"
              gap={3}
              shadow="sm"
              border="1px solid"
              borderColor={colors.borderSubtle}
            >
              <Box fontSize="2xl">🔒</Box>
              <Heading as="h3" fontSize="lg" fontWeight="semibold" color={colors.textPrimary}>
                Secure & Private
              </Heading>
              <Text color={colors.textSecondary} fontSize="sm">
                Row-level security ensures you only see your own data. Enterprise-grade encryption.
              </Text>
            </VStack>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Categories Section */}
      <Box bg={colors.cardBg} py={12}>
        <Container maxW="1200px" px={8}>
          <Heading as="h2" size="lg" textAlign="center" mb={4} color={colors.textPrimary}>
            Pre-Configured Categories
          </Heading>
          <Text color={colors.textSecondary} textAlign="center" mb={6} maxW="600px" mx="auto">
            Your account comes with expense categories ready to go. Add your own categories and merchant patterns anytime.
          </Text>
          <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} gap={3} maxW="900px" mx="auto">
            {categories.map((category) => (
              <Badge
                key={category}
                py={2}
                px={4}
                borderRadius="full"
                bg={colors.pageBg}
                color={colors.textPrimary}
                fontSize="sm"
                fontWeight="medium"
                textAlign="center"
                shadow="sm"
                border="1px solid"
                borderColor={colors.borderSubtle}
              >
                {category}
              </Badge>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Security Section */}
      <Box py={12} bg={colors.pageBg}>
        <Container maxW="800px" px={8} textAlign="center">
          <Heading as="h2" size="lg" mb={4} color={colors.textPrimary}>
            🔒 Enterprise-Grade Security
          </Heading>
          <Text color={colors.textSecondary} mb={6}>
            Built on Supabase with PostgreSQL. Row-level security ensures you only see your own data.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={6}>
            <VStack>
              <Text fontSize="xl">🛡️</Text>
              <Text fontWeight="semibold" fontSize="sm" color={colors.textPrimary}>Row-Level Security</Text>
              <Text color={colors.textSecondary} fontSize="xs">
                Database policies ensure data isolation
              </Text>
            </VStack>
            <VStack>
              <Text fontSize="xl">🔐</Text>
              <Text fontWeight="semibold" fontSize="sm" color={colors.textPrimary}>Encrypted Storage</Text>
              <Text color={colors.textSecondary} fontSize="xs">
                All data encrypted at rest
              </Text>
            </VStack>
            <VStack>
              <Text fontSize="xl">✅</Text>
              <Text fontWeight="semibold" fontSize="sm" color={colors.textPrimary}>Secure Auth</Text>
              <Text color={colors.textSecondary} fontSize="xs">
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
