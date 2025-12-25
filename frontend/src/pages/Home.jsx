import { useEffect, useState } from 'react'
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

  return (
    <Box as="main">
      {/* Hero Section */}
      <Container maxW="1200px" px={8} py={{ base: 20, md: 32 }}>
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          align="center"
          gap={16}
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
              Simple{' '}
              <Text as="span" color="blue.600" fontWeight="bold">
                Budget Tracking
              </Text>{' '}
              Tool
            </Heading>
            <Text fontSize={{ base: 'md', md: 'lg' }} color="gray.600" mb={8} lineHeight="1.8">
              Track your expenses, set budgets, and monitor your spending with this clean and
              intuitive budget management tool.
            </Text>
            <Button
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
              Start Tracking
            </Button>
          </Box>

          {/* Right side - Image */}
          <Box flex={1} maxW={{ base: '100%', lg: '600px' }}>
            <Box
              as="img"
              src="/images/hero-dashboard.png"
              alt="Budget dashboard preview"
              w="100%"
              h="auto"
            />
          </Box>
        </Flex>
      </Container>

      {/* Features Section */}
      <Box bg="gray.50" py={{ base: 16, md: 24 }} id="features">
        <Container maxW="1200px" px={8}>
          <Heading
            as="h2"
            fontSize={{ base: '2xl', md: '3xl', lg: '4xl' }}
            textAlign="center"
            mb={12}
          >
            Why Choose BudgetWise?
          </Heading>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={8}>
            {/* Feature 1 */}
            <VStack
              bg="white"
              p={8}
              borderRadius="lg"
              align="flex-start"
              gap={4}
              shadow="sm"
              _hover={{ shadow: 'md' }}
              transition="all 0.2s"
            >
              <Box fontSize="3xl">📊</Box>
              <Heading as="h3" fontSize="xl" fontWeight="semibold">
                Visual Reports
              </Heading>
              <Text color="gray.600" lineHeight="1.7">
                Get clear insights into your spending with beautiful charts and graphs.
              </Text>
            </VStack>

            {/* Feature 2 */}
            <VStack
              bg="white"
              p={8}
              borderRadius="lg"
              align="flex-start"
              gap={4}
              shadow="sm"
              _hover={{ shadow: 'md' }}
              transition="all 0.2s"
            >
              <Box fontSize="3xl">🎯</Box>
              <Heading as="h3" fontSize="xl" fontWeight="semibold">
                Goal Tracking
              </Heading>
              <Text color="gray.600" lineHeight="1.7">
                Set financial goals and track your progress toward achieving them.
              </Text>
            </VStack>

            {/* Feature 3 */}
            <VStack
              bg="white"
              p={8}
              borderRadius="lg"
              align="flex-start"
              gap={4}
              shadow="sm"
              _hover={{ shadow: 'md' }}
              transition="all 0.2s"
            >
              <Box fontSize="3xl">🔔</Box>
              <Heading as="h3" fontSize="xl" fontWeight="semibold">
                Smart Alerts
              </Heading>
              <Text color="gray.600" lineHeight="1.7">
                Receive notifications when you're approaching your budget limits.
              </Text>
            </VStack>

            {/* Feature 4 */}
            <VStack
              bg="white"
              p={8}
              borderRadius="lg"
              align="flex-start"
              gap={4}
              shadow="sm"
              _hover={{ shadow: 'md' }}
              transition="all 0.2s"
            >
              <Box fontSize="3xl">🔒</Box>
              <Heading as="h3" fontSize="xl" fontWeight="semibold">
                Secure & Private
              </Heading>
              <Text color="gray.600" lineHeight="1.7">
                Your financial data is encrypted and kept private at all times.
              </Text>
            </VStack>

            {/* Feature 5 */}
            <VStack
              bg="white"
              p={8}
              borderRadius="lg"
              align="flex-start"
              gap={4}
              shadow="sm"
              _hover={{ shadow: 'md' }}
              transition="all 0.2s"
            >
              <Box fontSize="3xl">📱</Box>
              <Heading as="h3" fontSize="xl" fontWeight="semibold">
                Mobile Friendly
              </Heading>
              <Text color="gray.600" lineHeight="1.7">
                Track your budget on the go with our responsive mobile design.
              </Text>
            </VStack>

            {/* Feature 6 */}
            <VStack
              bg="white"
              p={8}
              borderRadius="lg"
              align="flex-start"
              gap={4}
              shadow="sm"
              _hover={{ shadow: 'md' }}
              transition="all 0.2s"
            >
              <Box fontSize="3xl">💡</Box>
              <Heading as="h3" fontSize="xl" fontWeight="semibold">
                Easy to Use
              </Heading>
              <Text color="gray.600" lineHeight="1.7">
                Simple and intuitive interface that anyone can use right away.
              </Text>
            </VStack>
          </SimpleGrid>
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
