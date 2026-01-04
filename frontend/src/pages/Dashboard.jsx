import { Box, Container, Heading, Text, Button, VStack } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack gap={8} align="stretch">
        <Box>
          <Heading size="2xl">Dashboard</Heading>
          <Text color="gray.600" mt={2}>
            Welcome back, {user?.user_metadata?.full_name || user?.email}!
          </Text>
        </Box>

        <Box
          p={8}
          borderRadius="lg"
          borderWidth="1px"
          borderColor="gray.200"
          bg="white"
        >
          <VStack gap={4} align="start">
            <Heading size="lg">Your Budget Overview</Heading>
            <Text color="gray.600">
              This is your dashboard. Budget tracking features are coming soon!
            </Text>

            <Box mt={4}>
              <Text fontWeight="medium">User Information:</Text>
              <Text fontSize="sm" color="gray.600">
                Email: {user?.email}
              </Text>
              <Text fontSize="sm" color="gray.600">
                User ID: {user?.id}
              </Text>
            </Box>

            <Button colorScheme="red" onClick={handleSignOut} mt={4}>
              Sign Out
            </Button>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
}
