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

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const colors = useDarkModeColors();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await signIn(email, password);

      if (error) {
        setError(error.message);
      } else if (data) {
        // Redirect to dashboard on successful login
        navigate('/dashboard');
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
            <Heading size="2xl" color={colors.textPrimary}>Welcome Back</Heading>
          <Text color={colors.textSecondary} mt={2}>
            Sign in to your BudgetWise account
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
            </Stack>

            <Link
              as={RouterLink}
              to="/forgot-password"
              color="blue.600"
              fontSize="sm"
              alignSelf="flex-end"
            >
              Forgot password?
            </Link>

            <Button
              type="submit"
              colorScheme="blue"
              size="lg"
              w="100%"
              mt={2}
              loading={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <Text textAlign="center" color={colors.textSecondary}>
              Don't have an account?{' '}
              <Link as={RouterLink} to="/signup" color="blue.600" fontWeight="medium">
                Sign up
              </Link>
            </Text>
          </VStack>
        </Box>
      </VStack>
      </Container>
    </Box>
  );
}
