import { useState } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import {
  Box,
  Flex,
  HStack,
  IconButton,
  useDisclosure,
  Stack,
  Text,
} from '@chakra-ui/react'

function Header() {
  const { open, onToggle } = useDisclosure()
  const location = useLocation()

  const isActive = (path) => {
    return location.pathname === path
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
        maxW="1200px"
        mx="auto"
        px={8}
        py={4}
        align="center"
        justify="space-between"
      >
        {/* Logo */}
        <Flex align="center" gap={2}>
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
          <Box
            as={RouterLink}
            to="/features"
            color={isActive('/features') ? 'blue.600' : 'gray.600'}
            fontWeight={isActive('/features') ? 'semibold' : 'normal'}
            _hover={{ color: 'blue.600' }}
            transition="color 0.2s"
          >
            Features
          </Box>
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
            <Box
              as={RouterLink}
              to="/features"
              color={isActive('/features') ? 'blue.600' : 'gray.600'}
              fontWeight={isActive('/features') ? 'semibold' : 'normal'}
              onClick={onToggle}
            >
              Features
            </Box>
          </Stack>
        </Box>
      )}
    </Box>
  )
}

export default Header
