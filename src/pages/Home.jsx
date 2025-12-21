import { useEffect, useState } from 'react'
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  SimpleGrid,
  VStack,
  IconButton,
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
      <Container maxW="1200px" px={8}>
        {/* Hero Section */}
        <Flex
          align="center"
          justify="space-between"
          gap={16}
          py={16}
          minH="80vh"
          direction={{ base: 'column', md: 'row' }}
          textAlign={{ base: 'center', md: 'left' }}
        >
          <VStack
            flex={1}
            maxW="600px"
            align={{ base: 'center', md: 'flex-start' }}
            gap={4}
          >
            <Heading as="h1" size="3xl" lineHeight="1.2">
              Simple <Text as="span" color="blue.600">Budget Tracking</Text> Tool
            </Heading>
            <Text fontSize="xl" color="gray.600">
              Track your expenses, set budgets, and monitor your spending with
              this clean and intuitive budget management tool.
            </Text>
            <Flex gap={4} pt={4}>
              <Button colorScheme="blue" size="lg">
                Start Tracking
              </Button>
            </Flex>
          </VStack>
          <Box flex={1} textAlign="center">
            <Box
              as="img"
              src="/images/hero-dashboard.png"
              alt="Budget dashboard preview"
              maxW="500px"
              w="100%"
            />
          </Box>
        </Flex>
      </Container>

      {/* Features Preview Section */}
      <Box bg="gray.50" py={16} id="features">
        <Container maxW="1000px">
          <Heading as="h2" size="xl" textAlign="center" mb={16}>
            Why Choose BudgetWise?
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={8}>
            <VStack
              bg="white"
              p={8}
              borderRadius="md"
              shadow="md"
              _hover={{ transform: 'translateY(-4px)' }}
              transition="transform 0.2s"
              opacity={0}
              animation="fadeIn 0.5s ease forwards"
            >
              <Text fontSize="4xl">📊</Text>
              <Heading as="h3" size="md" mt={4}>
                Visual Reports
              </Heading>
              <Text color="gray.600" textAlign="center">
                See where your money goes with beautiful charts and graphs.
              </Text>
            </VStack>
            <VStack
              bg="white"
              p={8}
              borderRadius="md"
              shadow="md"
              _hover={{ transform: 'translateY(-4px)' }}
              transition="transform 0.2s"
              opacity={0}
              animation="fadeIn 0.5s ease forwards 0.1s"
            >
              <Text fontSize="4xl">🎯</Text>
              <Heading as="h3" size="md" mt={4}>
                Goal Tracking
              </Heading>
              <Text color="gray.600" textAlign="center">
                Set savings goals and track your progress in real-time.
              </Text>
            </VStack>
            <VStack
              bg="white"
              p={8}
              borderRadius="md"
              shadow="md"
              _hover={{ transform: 'translateY(-4px)' }}
              transition="transform 0.2s"
              opacity={0}
              animation="fadeIn 0.5s ease forwards 0.2s"
            >
              <Text fontSize="4xl">🔔</Text>
              <Heading as="h3" size="md" mt={4}>
                Smart Alerts
              </Heading>
              <Text color="gray.600" textAlign="center">
                Get notified when you're approaching your budget limits.
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
          colorScheme="blue"
          borderRadius="full"
          size="lg"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          _hover={{ transform: 'translateY(-3px)' }}
          transition="all 0.3s"
        >
          ↑
        </IconButton>
      )}
    </Box>
  )
}

export default Home
