import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  VStack,
  HStack,
  Text,
  Spinner,
  Button,
  Badge,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import PageContainer from '../components/PageContainer';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showNotification,
} from '../lib/notifications';

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('checking');
  const [requestingPermission, setRequestingPermission] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = () => {
    if (!isNotificationSupported()) {
      setNotificationStatus('unsupported');
    } else {
      setNotificationStatus(getNotificationPermission());
    }
  };

  const handleEnableNotifications = async () => {
    setRequestingPermission(true);
    try {
      const permission = await requestNotificationPermission();
      setNotificationStatus(permission);

      if (permission === 'granted') {
        // Send a test notification
        showNotification('Notifications Enabled!', {
          body: 'You will now receive budget alerts and transaction notifications.',
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleTestNotification = () => {
    showNotification('Test Notification', {
      body: 'This is a test notification from BudgetWise!',
    });
  };

  const getStatusBadge = () => {
    switch (notificationStatus) {
      case 'granted':
        return <Badge colorPalette="green">Enabled</Badge>;
      case 'denied':
        return <Badge colorPalette="red">Blocked</Badge>;
      case 'unsupported':
        return <Badge colorPalette="gray">Not Supported</Badge>;
      default:
        return <Badge colorPalette="yellow">Not Enabled</Badge>;
    }
  };

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

        {/* Notifications Section */}
        <Box p={6} borderWidth="1px" borderRadius="lg" bg="white">
          <Heading size="lg" mb={4}>
            Push Notifications
          </Heading>
          <VStack align="stretch" gap={4}>
            <HStack justify="space-between">
              <Text>Status:</Text>
              {getStatusBadge()}
            </HStack>

            {notificationStatus === 'unsupported' && (
              <Box p={4} bg="yellow.50" borderRadius="md" borderColor="yellow.200" borderWidth="1px">
                <Text color="yellow.700" fontSize="sm">
                  Push notifications are not supported in this browser. For the best experience, add this app to your home screen on iOS 16.4+ or use Chrome on Android.
                </Text>
              </Box>
            )}

            {notificationStatus === 'denied' && (
              <Box p={4} bg="red.50" borderRadius="md" borderColor="red.200" borderWidth="1px">
                <Text color="red.700" fontSize="sm">
                  Notifications are blocked. To enable them, go to your browser settings and allow notifications for this site.
                </Text>
              </Box>
            )}

            {notificationStatus === 'default' && (
              <Button
                colorPalette="blue"
                onClick={handleEnableNotifications}
                loading={requestingPermission}
                loadingText="Requesting..."
              >
                Enable Notifications
              </Button>
            )}

            {notificationStatus === 'granted' && (
              <VStack align="stretch" gap={3}>
                <Text color="gray.600" fontSize="sm">
                  You will receive notifications for:
                </Text>
                <VStack align="start" gap={1} pl={4}>
                  <Text fontSize="sm">• New transactions added</Text>
                  <Text fontSize="sm">• Budget limit warnings (80%, 90%, 100%)</Text>
                </VStack>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotification}
                  mt={2}
                >
                  Send Test Notification
                </Button>
              </VStack>
            )}
          </VStack>
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
