import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
import { useAuth } from '../contexts/AuthContext';
import { useDarkModeColors } from '../lib/useDarkModeColors';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const colors = useDarkModeColors();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await resetPassword(email);

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box bg={colors.pageBg} minH="calc(100vh - 140px)">
      <Container maxW="md" py={12}>
        <VStack gap={8}>
          <Box textAlign="center">
            <Heading size="2xl" color={colors.textPrimary}>Reset Password</Heading>
            <Text color={colors.textSecondary} mt={2}>
              Enter your email to receive a password reset link
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
                      Password reset email sent!
                    </Text>
                    <Text color={colors.textSecondary} fontSize="sm" textAlign="center">
                      Check your inbox for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder.
                    </Text>
                    <Link as={RouterLink} to="/login" color="blue.600" fontWeight="medium">
                      Back to Sign In
                    </Link>
                  </VStack>
                </Box>
              ) : (
                <>
                  <Stack gap={2} w="100%">
                    <Text fontWeight="medium" color={colors.textPrimary}>Email</Text>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>

                  <Text textAlign="center" color={colors.textSecondary}>
                    Remember your password?{' '}
                    <Link as={RouterLink} to="/login" color="blue.600" fontWeight="medium">
                      Sign in
                    </Link>
                  </Text>
                </>
              )}
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
