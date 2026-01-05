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

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

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
    <Container maxW="md" py={12}>
      <VStack gap={8}>
        <Box textAlign="center">
          <Heading size="2xl">Create Account</Heading>
          <Text color="gray.600" mt={2}>
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

            {success && (
              <Box
                p={3}
                bg="green.50"
                borderColor="green.500"
                borderWidth="1px"
                borderRadius="md"
                w="100%"
              >
                <Text color="green.700" fontWeight="medium">
                  Account created! Please check your email to verify your account.
                </Text>
              </Box>
            )}

            <Stack gap={2} w="100%">
              <Text fontWeight="medium">Full Name</Text>
              <Input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                size="lg"
              />
            </Stack>

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
              <Text fontSize="xs" color="gray.500">
                Must be at least 6 characters
              </Text>
            </Stack>

            <Stack gap={2} w="100%">
              <Text fontWeight="medium">Confirm Password</Text>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                size="lg"
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

            <Text textAlign="center" color="gray.600">
              Already have an account?{' '}
              <Link as={RouterLink} to="/login" color="blue.600" fontWeight="medium">
                Sign in
              </Link>
            </Text>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
}
