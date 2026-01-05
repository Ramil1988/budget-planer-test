import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  VStack,
  Text,
  Spinner,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import PageContainer from '../components/PageContainer';

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (loading) {
    return (
      <PageContainer>
        <Flex w="100%" minH="60vh" align="center" justify="center">
          <VStack gap={4}>
            <Spinner size="xl" />
            <Text>Loading settings...</Text>
          </VStack>
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <VStack gap={8} align="stretch" w="100%">
        <Box>
          <Heading size="2xl">Settings</Heading>
          <Text color="gray.600" mt={2}>
            Manage your account settings
          </Text>
        </Box>

        {/* Account Info */}
        <Box p={6} borderWidth="1px" borderRadius="lg" bg="white">
          <Heading size="lg" mb={4}>
            Account Information
          </Heading>
          <VStack align="start" gap={2}>
            <Text>
              <strong>Email:</strong> {user?.email}
            </Text>
            <Text>
              <strong>User ID:</strong> {user?.id}
            </Text>
          </VStack>
        </Box>

        {/* Info box pointing to Import */}
        <Box p={4} bg="blue.50" borderRadius="md" borderColor="blue.200" borderWidth="1px">
          <Text color="blue.700">
            <strong>Looking for Google Sheet sync?</strong> Go to the <strong>Import</strong> tab to connect your Google Sheet and configure auto-sync settings.
          </Text>
        </Box>
      </VStack>
    </PageContainer>
  );
}
