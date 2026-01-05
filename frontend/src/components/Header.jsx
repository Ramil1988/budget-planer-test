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
  Heading,
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
    navigate('/')
  }

  const NavLink = ({ to, children, onClick }) => (
    <Box
      as={RouterLink}
      to={to}
      onClick={onClick}
      px={3}
      py={2}
      borderRadius="8px"
      fontWeight="500"
      fontSize="14px"
      color={isActive(to) ? '#2563EB' : '#52525B'}
      bg={isActive(to) ? '#EFF6FF' : 'transparent'}
      _hover={{
        color: '#2563EB',
        bg: '#EFF6FF',
      }}
      transition="all 0.15s"
    >
      {children}
    </Box>
  )

  return (
    <Box
      as="header"
      bg="rgba(255, 255, 255, 0.9)"
      backdropFilter="blur(12px)"
      borderBottom="1px solid"
      borderColor="#F4F4F5"
      position="sticky"
      top="0"
      zIndex="100"
    >
      <Flex
        w="100%"
        maxW="1200px"
        mx="auto"
        px={8}
        py={3}
        align="center"
        justify="space-between"
      >
        {/* Logo */}
        <Flex
          as={RouterLink}
          to="/"
          align="center"
          gap={2}
          flexShrink={0}
          _hover={{ textDecoration: 'none' }}
        >
          <Flex
            w="36px"
            h="36px"
            borderRadius="10px"
            bg="linear-gradient(135deg, #18181B 0%, #3B82F6 100%)"
            align="center"
            justify="center"
            boxShadow="0 2px 8px rgba(37, 99, 235, 0.3)"
          >
            <Text fontSize="lg">💰</Text>
          </Flex>
          <Heading
            size="md"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontWeight="700"
            color="#18181B"
            letterSpacing="-0.02em"
          >
            BudgetWise
          </Heading>
        </Flex>

        {/* Desktop Navigation */}
        <HStack as="nav" gap={1} display={{ base: 'none', md: 'flex' }}>
          {user && (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/transactions">Transactions</NavLink>
              <NavLink to="/budget">Budget</NavLink>
              <NavLink to="/categories">Categories</NavLink>
              <NavLink to="/import">Import</NavLink>
              <NavLink to="/reports">Reports</NavLink>
              <NavLink to="/settings">Settings</NavLink>
            </>
          )}
        </HStack>

        {/* Desktop Auth Button */}
        <HStack gap={3} display={{ base: 'none', md: 'flex' }}>
          {!user && (
            <Button
              as={RouterLink}
              to="/login"
              size="sm"
              bg="linear-gradient(135deg, #18181B 0%, #2563EB 100%)"
              color="white"
              fontWeight="600"
              borderRadius="8px"
              px={5}
              _hover={{
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
              transition="all 0.2s"
            >
              Sign In
            </Button>
          )}
          {user && (
            <Button
              onClick={handleSignOut}
              size="sm"
              bg="white"
              color="#52525B"
              fontWeight="500"
              borderRadius="8px"
              border="1px solid #E4E4E7"
              _hover={{ bg: '#FAFAFA', borderColor: '#D4D4D8' }}
              transition="all 0.15s"
            >
              Sign Out
            </Button>
          )}
        </HStack>

        {/* Mobile Menu Button */}
        <IconButton
          display={{ base: 'flex', md: 'none' }}
          onClick={onToggle}
          variant="ghost"
          aria-label="Toggle navigation"
          size="sm"
          borderRadius="8px"
          _hover={{ bg: '#F4F4F5' }}
        >
          <Box
            as="span"
            display="flex"
            flexDirection="column"
            gap="4px"
            w="18px"
          >
            <Box
              h="2px"
              bg="#52525B"
              borderRadius="full"
              transform={open ? 'rotate(45deg) translateY(6px)' : 'none'}
              transition="all 0.2s"
            />
            <Box
              h="2px"
              bg="#52525B"
              borderRadius="full"
              opacity={open ? 0 : 1}
              transition="all 0.2s"
            />
            <Box
              h="2px"
              bg="#52525B"
              borderRadius="full"
              transform={open ? 'rotate(-45deg) translateY(-6px)' : 'none'}
              transition="all 0.2s"
            />
          </Box>
        </IconButton>
      </Flex>

      {/* Mobile Navigation */}
      {open && (
        <Box
          display={{ base: 'block', md: 'none' }}
          bg="white"
          borderTop="1px solid #F4F4F5"
          shadow="lg"
        >
          <Stack maxW="1200px" mx="auto" px={8} py={4} gap={1}>
            {!user && (
              <Box>
                <Button
                  as={RouterLink}
                  to="/login"
                  w="100%"
                  size="md"
                  bg="linear-gradient(135deg, #18181B 0%, #2563EB 100%)"
                  color="white"
                  fontWeight="600"
                  borderRadius="10px"
                  _hover={{ opacity: 0.9 }}
                  onClick={onToggle}
                >
                  Sign In
                </Button>
              </Box>
            )}
            {user && (
              <>
                <MobileNavLink to="/dashboard" active={isActive('/dashboard')} onClick={onToggle}>
                  Dashboard
                </MobileNavLink>
                <MobileNavLink to="/transactions" active={isActive('/transactions')} onClick={onToggle}>
                  Transactions
                </MobileNavLink>
                <MobileNavLink to="/budget" active={isActive('/budget')} onClick={onToggle}>
                  Budget
                </MobileNavLink>
                <MobileNavLink to="/categories" active={isActive('/categories')} onClick={onToggle}>
                  Categories
                </MobileNavLink>
                <MobileNavLink to="/import" active={isActive('/import')} onClick={onToggle}>
                  Import
                </MobileNavLink>
                <MobileNavLink to="/reports" active={isActive('/reports')} onClick={onToggle}>
                  Reports
                </MobileNavLink>
                <MobileNavLink to="/settings" active={isActive('/settings')} onClick={onToggle}>
                  Settings
                </MobileNavLink>
                <Box pt={3} borderTop="1px solid #F4F4F5" mt={2}>
                  <Button
                    onClick={() => {
                      handleSignOut()
                      onToggle()
                    }}
                    w="100%"
                    size="md"
                    bg="#FAFAFA"
                    color="#52525B"
                    fontWeight="500"
                    borderRadius="10px"
                    _hover={{ bg: '#F4F4F5' }}
                  >
                    Sign Out
                  </Button>
                </Box>
              </>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  )
}

const MobileNavLink = ({ to, children, active, onClick }) => (
  <Box
    as={RouterLink}
    to={to}
    onClick={onClick}
    display="block"
    px={4}
    py={3}
    borderRadius="10px"
    fontWeight="500"
    fontSize="14px"
    color={active ? '#2563EB' : '#52525B'}
    bg={active ? '#EFF6FF' : 'transparent'}
    _hover={{
      bg: '#EFF6FF',
      color: '#2563EB',
    }}
    transition="all 0.15s"
  >
    {children}
  </Box>
)

export default Header
