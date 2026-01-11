import { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  VStack,
  Text,
  Link,
  Stack,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabaseClient';
import { useDarkModeColors } from '../lib/useDarkModeColors';

export default function ResetPassword() {
  const navigate = useNavigate();
  const colors = useDarkModeColors();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user arrived via password reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      }
      setCheckingSession(false);
    };
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <Box bg={colors.pageBg} minH="calc(100vh - 140px)">
        <Container maxW="md" py={12}>
          <VStack gap={8}>
            <Text color={colors.textSecondary}>Loading...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (!isValidSession) {
    return (
      <Box bg={colors.pageBg} minH="calc(100vh - 140px)">
        <Container maxW="md" py={12}>
          <VStack gap={8}>
            <Box textAlign="center">
              <Heading size="2xl" color={colors.textPrimary}>Invalid Link</Heading>
              <Text color={colors.textSecondary} mt={2}>
                This password reset link is invalid or has expired.
              </Text>
            </Box>
            <Box
              w="100%"
              p={8}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={colors.borderColor}
              bg={colors.cardBg}
              textAlign="center"
            >
              <VStack gap={4}>
                <Text color={colors.textSecondary}>
                  Please request a new password reset link.
                </Text>
                <Link as={RouterLink} to="/forgot-password" color="blue.600" fontWeight="medium">
                  Request New Link
                </Link>
              </VStack>
            </Box>
          </VStack>
        </Container>
      </Box>
    );
  }

  return (
    <Box bg={colors.pageBg} minH="calc(100vh - 140px)">
      <Container maxW="md" py={12}>
        <VStack gap={8}>
          <Box textAlign="center">
            <Heading size="2xl" color={colors.textPrimary}>Set New Password</Heading>
            <Text color={colors.textSecondary} mt={2}>
              Enter your new password below
            </Text>
          </Box>

          <Box
            as="form"
            onSubmit={handleSubmit}
            w="100%"
            p={8}
            borderRadius="lg"
            borderWidth="1px"
            borderColor={colors.borderColor}
            bg={colors.cardBg}
          >
            <VStack gap={4}>
              {error && (
                <Box
                  p={3}
                  bg={colors.dangerBg}
                  borderColor={colors.dangerBorder}
                  borderWidth="1px"
                  borderRadius="md"
                  w="100%"
                >
                  <Text color={colors.danger} fontWeight="medium">
                    {error}
                  </Text>
                </Box>
              )}

              {success ? (
                <Box
                  p={4}
                  bg={colors.successBg}
                  borderColor={colors.successBorder}
                  borderWidth="1px"
                  borderRadius="md"
                  w="100%"
                >
                  <VStack gap={3}>
                    <Text color={colors.success} fontWeight="medium" textAlign="center">
                      Password updated successfully!
                    </Text>
                    <Text color={colors.textSecondary} fontSize="sm" textAlign="center">
                      Redirecting to dashboard...
                    </Text>
                  </VStack>
                </Box>
              ) : (
                <>
                  <Stack gap={2} w="100%">
                    <Text fontWeight="medium" color={colors.textPrimary}>New Password</Text>
                    <Input
                      type="password"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      size="lg"
                      bg={colors.cardBg}
                      borderColor={colors.borderColor}
                      color={colors.textPrimary}
                    />
                    <Text fontSize="xs" color={colors.textMuted}>
                      Must be at least 6 characters
                    </Text>
                  </Stack>

                  <Stack gap={2} w="100%">
                    <Text fontWeight="medium" color={colors.textPrimary}>Confirm Password</Text>
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      size="lg"
                      bg={colors.cardBg}
                      borderColor={colors.borderColor}
                      color={colors.textPrimary}
                    />
                  </Stack>

                  <Button
                    type="submit"
                    colorScheme="blue"
                    size="lg"
                    w="100%"
                    mt={2}
                    loading={loading}
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </>
              )}
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
