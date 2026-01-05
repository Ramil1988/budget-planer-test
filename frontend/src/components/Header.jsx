import { useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Flex,
  HStack,
  IconButton,
  useDisclosure,
  Stack,
  Text,
  Button,
} from '@chakra-ui/react'
import { useAuth } from '../contexts/AuthContext'

function Header() {
  const { open, onToggle } = useDisclosure()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const isActive = (path) => {
    return location.pathname === path
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <Box
      as="header"
      bg="white"
      borderBottom="1px"
      borderColor="gray.200"
      position="sticky"
      top="0"
      zIndex="100"
      shadow="sm"
    >
      <Flex
        w="100%"
        px={8}
        py={4}
        align="center"
        justify="space-between"
      >
        {/* Logo */}
        <Flex
          as={RouterLink}
          to="/"
          align="center"
          gap={2}
          mr={8}
          flexShrink={0}
          _hover={{ textDecoration: 'none', opacity: 0.8 }}
          transition="opacity 0.2s"
        >
          <Text fontSize="2xl">💰</Text>
          <Text fontSize="xl" fontWeight="bold">
            BudgetWise
          </Text>
        </Flex>

        {/* Desktop Navigation */}
        <HStack as="nav" gap={8} display={{ base: 'none', md: 'flex' }}>
          <Box
            as={RouterLink}
            to="/"
            color={isActive('/') ? 'blue.600' : 'gray.600'}
            fontWeight={isActive('/') ? 'semibold' : 'normal'}
            _hover={{ color: 'blue.600' }}
            transition="color 0.2s"
          >
            Home
          </Box>
          {user ? (
            <>
              <Box
                as={RouterLink}
                to="/dashboard"
                color={isActive('/dashboard') ? 'blue.600' : 'gray.600'}
                fontWeight={isActive('/dashboard') ? 'semibold' : 'normal'}
                _hover={{ color: 'blue.600' }}
                transition="color 0.2s"
              >
                Dashboard
              </Box>
              <Box
                as={RouterLink}
                to="/import"
                color={isActive('/import') ? 'blue.600' : 'gray.600'}
                fontWeight={isActive('/import') ? 'semibold' : 'normal'}
                _hover={{ color: 'blue.600' }}
                transition="color 0.2s"
              >
                Import
              </Box>
              <Box
                as={RouterLink}
                to="/categories"
                color={isActive('/categories') ? 'blue.600' : 'gray.600'}
                fontWeight={isActive('/categories') ? 'semibold' : 'normal'}
                _hover={{ color: 'blue.600' }}
                transition="color 0.2s"
              >
                Category Manager
              </Box>
              <Box
                as={RouterLink}
                to="/transactions"
                color={isActive('/transactions') ? 'blue.600' : 'gray.600'}
                fontWeight={isActive('/transactions') ? 'semibold' : 'normal'}
                _hover={{ color: 'blue.600' }}
                transition="color 0.2s"
              >
                Transactions
              </Box>
              <Box
                as={RouterLink}
                to="/budget"
                color={isActive('/budget') ? 'blue.600' : 'gray.600'}
                fontWeight={isActive('/budget') ? 'semibold' : 'normal'}
                _hover={{ color: 'blue.600' }}
                transition="color 0.2s"
              >
                Budget
              </Box>
              <Box
                as={RouterLink}
                to="/reports"
                color={isActive('/reports') ? 'blue.600' : 'gray.600'}
                fontWeight={isActive('/reports') ? 'semibold' : 'normal'}
                _hover={{ color: 'blue.600' }}
                transition="color 0.2s"
              >
                Reports
              </Box>
              <Box
                as={RouterLink}
                to="/settings"
                color={isActive('/settings') ? 'blue.600' : 'gray.600'}
                fontWeight={isActive('/settings') ? 'semibold' : 'normal'}
                _hover={{ color: 'blue.600' }}
                transition="color 0.2s"
              >
                Settings
              </Box>
              <Button
                onClick={handleSignOut}
                size="sm"
                colorScheme="red"
                variant="outline"
              >
                Sign Out
              </Button>
            </>
          ) : null}
        </HStack>

        {/* Mobile Menu Button */}
        <IconButton
          display={{ base: 'flex', md: 'none' }}
          onClick={onToggle}
          variant="ghost"
          aria-label="Toggle navigation"
        >
          {open ? '✕' : '☰'}
        </IconButton>
      </Flex>

      {/* Mobile Navigation */}
      {open && (
        <Box
          display={{ base: 'block', md: 'none' }}
          bg="white"
          borderBottom="1px"
          borderColor="gray.200"
        >
          <Stack px={8} py={4} gap={4}>
            <Box
              as={RouterLink}
              to="/"
              color={isActive('/') ? 'blue.600' : 'gray.600'}
              fontWeight={isActive('/') ? 'semibold' : 'normal'}
              onClick={onToggle}
            >
              Home
            </Box>
            {user ? (
              <>
                <Box
                  as={RouterLink}
                  to="/dashboard"
                  color={isActive('/dashboard') ? 'blue.600' : 'gray.600'}
                  fontWeight={isActive('/dashboard') ? 'semibold' : 'normal'}
                  onClick={onToggle}
                >
                  Dashboard
                </Box>
                <Box
                  as={RouterLink}
                  to="/import"
                  color={isActive('/import') ? 'blue.600' : 'gray.600'}
                  fontWeight={isActive('/import') ? 'semibold' : 'normal'}
                  onClick={onToggle}
                >
                  Import
                </Box>
                <Box
                  as={RouterLink}
                  to="/categories"
                  color={isActive('/categories') ? 'blue.600' : 'gray.600'}
                  fontWeight={isActive('/categories') ? 'semibold' : 'normal'}
                  onClick={onToggle}
                >
                  Category Manager
                </Box>
                <Box
                  as={RouterLink}
                  to="/transactions"
                  color={isActive('/transactions') ? 'blue.600' : 'gray.600'}
                  fontWeight={isActive('/transactions') ? 'semibold' : 'normal'}
                  onClick={onToggle}
                >
                  Transactions
                </Box>
                <Box
                  as={RouterLink}
                  to="/budget"
                  color={isActive('/budget') ? 'blue.600' : 'gray.600'}
                  fontWeight={isActive('/budget') ? 'semibold' : 'normal'}
                  onClick={onToggle}
                >
                  Budget
                </Box>
                <Box
                  as={RouterLink}
                  to="/reports"
                  color={isActive('/reports') ? 'blue.600' : 'gray.600'}
                  fontWeight={isActive('/reports') ? 'semibold' : 'normal'}
                  onClick={onToggle}
                >
                  Reports
                </Box>
                <Box
                  as={RouterLink}
                  to="/settings"
                  color={isActive('/settings') ? 'blue.600' : 'gray.600'}
                  fontWeight={isActive('/settings') ? 'semibold' : 'normal'}
                  onClick={onToggle}
                >
                  Settings
                </Box>
                <Button
                  onClick={() => {
                    handleSignOut()
                    onToggle()
                  }}
                  size="sm"
                  colorScheme="red"
                  variant="outline"
                >
                  Sign Out
                </Button>
              </>
            ) : null}
          </Stack>
        </Box>
      )}
    </Box>
  )
}

export default Header
