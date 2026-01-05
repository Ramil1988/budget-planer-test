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

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

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
    <Container maxW="md" py={12}>
      <VStack gap={8}>
        <Box textAlign="center">
          <Heading size="2xl">Welcome Back</Heading>
          <Text color="gray.600" mt={2}>
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
          borderColor="gray.200"
        >
          <VStack gap={4}>
            {error && (
              <Box
                p={3}
                bg="red.50"
                borderColor="red.500"
                borderWidth="1px"
                borderRadius="md"
                w="100%"
              >
                <Text color="red.700" fontWeight="medium">
                  {error}
                </Text>
              </Box>
            )}

            <Stack gap={2} w="100%">
              <Text fontWeight="medium">Email</Text>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                size="lg"
              />
            </Stack>

            <Stack gap={2} w="100%">
              <Text fontWeight="medium">Password</Text>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                size="lg"
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

            <Text textAlign="center" color="gray.600">
              Don't have an account?{' '}
              <Link as={RouterLink} to="/signup" color="blue.600" fontWeight="medium">
                Sign up
              </Link>
            </Text>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
}
