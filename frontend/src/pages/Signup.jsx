import { useState } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import { useDarkModeColors } from '../lib/useDarkModeColors';

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const colors = useDarkModeColors();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await signUp(email, password, {
        full_name: fullName,
      });

      if (error) {
        setError(error.message);
      } else if (data) {
        setSuccess(true);
        // Note: User needs to verify email before logging in
        setTimeout(() => {
          navigate('/login');
        }, 3000);
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
            <Heading size="2xl" color={colors.textPrimary}>Create Account</Heading>
          <Text color={colors.textSecondary} mt={2}>
            Start tracking your budget with BudgetWise
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

            {success && (
              <Box
                p={3}
                bg={colors.successBg}
                borderColor={colors.successBorder}
                borderWidth="1px"
                borderRadius="md"
                w="100%"
              >
                <Text color={colors.success} fontWeight="medium">
                  Account created! Please check your email to verify your account.
                </Text>
              </Box>
            )}

            <Stack gap={2} w="100%">
              <Text fontWeight="medium" color={colors.textPrimary}>Full Name</Text>
              <Input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                size="lg"
                bg={colors.cardBg}
                borderColor={colors.borderColor}
                color={colors.textPrimary}
              />
            </Stack>

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

            <Stack gap={2} w="100%">
              <Text fontWeight="medium" color={colors.textPrimary}>Password</Text>
              <Input
                type="password"
                placeholder="••••••••"
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
                placeholder="••••••••"
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
              disabled={success}
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>

            <Text textAlign="center" color={colors.textSecondary}>
              Already have an account?{' '}
              <Link as={RouterLink} to="/login" color="blue.600" fontWeight="medium">
                Sign in
              </Link>
            </Text>
          </VStack>
        </Box>
      </VStack>
      </Container>
    </Box>
  );
}
