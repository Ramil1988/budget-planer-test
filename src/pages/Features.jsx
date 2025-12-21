import { useEffect, useState } from 'react'
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  VStack,
  Stack,
  IconButton,
} from '@chakra-ui/react'

function Features() {
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
        {/* Page Hero */}
        <Box py={16} textAlign="center">
          <Heading as="h1" size="2xl" mb={4}>
            Powerful Features for <Text as="span" color="blue.600">Smart Budgeting</Text>
          </Heading>
          <Text fontSize="xl" color="gray.600" maxW="600px" mx="auto">
            Everything you need to take control of your finances in one simple app.
          </Text>
        </Box>

        {/* Detailed Features Section */}
        <VStack gap={16} py={16} maxW="1000px" mx="auto">
          {/* Visual Reports */}
          <Flex
            align="center"
            gap={16}
            direction={{ base: 'column', md: 'row' }}
            textAlign={{ base: 'center', md: 'left' }}
          >
            <VStack flex={1} align={{ base: 'center', md: 'flex-start' }} gap={4}>
              <Heading as="h2" size="lg">
                📊 Visual Reports & Analytics
              </Heading>
              <Text color="gray.600">
                Understand your spending habits with beautiful, easy-to-read charts.
                See exactly where your money goes each month with breakdowns by
                category.
              </Text>
              <Stack gap={2}>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Monthly spending pie charts</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Income vs expenses comparison</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Trend analysis over time</Text>
                </Flex>
              </Stack>
            </VStack>
            <Box flex={1}>
              <Box as="img" src="/images/visual.jpg" alt="Visual reports dashboard" w="100%" />
            </Box>
          </Flex>

          {/* Goal Tracking */}
          <Flex
            align="center"
            gap={16}
            direction={{ base: 'column', md: 'row-reverse' }}
            textAlign={{ base: 'center', md: 'left' }}
          >
            <VStack flex={1} align={{ base: 'center', md: 'flex-start' }} gap={4}>
              <Heading as="h2" size="lg">
                🎯 Goal Tracking
              </Heading>
              <Text color="gray.600">
                Set savings goals and watch your progress in real-time. Whether it's
                a vacation, emergency fund, or new car - we help you get there.
              </Text>
              <Stack gap={2}>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Create unlimited savings goals</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Visual progress bars</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Milestone celebrations</Text>
                </Flex>
              </Stack>
            </VStack>
            <Box flex={1}>
              <Box as="img" src="/images/goal-tracking.png" alt="Goal tracking interface" w="100%" />
            </Box>
          </Flex>

          {/* Smart Alerts */}
          <Flex
            align="center"
            gap={16}
            direction={{ base: 'column', md: 'row' }}
            textAlign={{ base: 'center', md: 'left' }}
          >
            <VStack flex={1} align={{ base: 'center', md: 'flex-start' }} gap={4}>
              <Heading as="h2" size="lg">
                🔔 Smart Alerts & Notifications
              </Heading>
              <Text color="gray.600">
                Never overspend again. Get notified when you're approaching budget
                limits or when unusual spending is detected.
              </Text>
              <Stack gap={2}>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Budget limit warnings</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Bill payment reminders</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Weekly spending summaries</Text>
                </Flex>
              </Stack>
            </VStack>
            <Box flex={1}>
              <Box as="img" src="/images/alerts.png" alt="Smart alerts example" w="100%" />
            </Box>
          </Flex>

          {/* Receipt Scanner */}
          <Flex
            align="center"
            gap={16}
            direction={{ base: 'column', md: 'row' }}
            textAlign={{ base: 'center', md: 'left' }}
          >
            <VStack flex={1} align={{ base: 'center', md: 'flex-start' }} gap={4}>
              <Heading as="h2" size="lg">
                📸 Smart Receipt Scanner
              </Heading>
              <Text color="gray.600">
                Simply snap a photo of your receipts or bank statements and let our
                OCR technology do the rest. All expenses are automatically extracted
                and added to your tracking sheet.
              </Text>
              <Stack gap={2}>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Instant receipt scanning via camera or screenshot</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Automatic expense categorization</Text>
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text color="blue.600" fontWeight="bold">✓</Text>
                  <Text>Bulk import from bank statement images</Text>
                </Flex>
              </Stack>
            </VStack>
            <Box flex={1}>
              <Box as="img" src="/images/OCR.jpg" alt="OCR receipt scanner feature" w="100%" />
            </Box>
          </Flex>
        </VStack>
      </Container>

      {/* CTA Section */}
      <Box bg="blue.600" color="white" py={16} textAlign="center">
        <Container maxW="1200px" px={8}>
          <Heading as="h2" size="xl" mb={2}>
            Ready to Take Control?
          </Heading>
          <Text opacity={0.9} mb={8} fontSize="lg">
            Start tracking your budget and build better financial habits today.
          </Text>
          <Flex justify="center" gap={4}>
            <Button
              bg="white"
              color="blue.600"
              size="lg"
              _hover={{ bg: 'gray.100' }}
            >
              Launch Tool
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

export default Features
