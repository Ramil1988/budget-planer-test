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
import { ColorModeButton, useColorModeValue } from './ui/color-mode'

function Header() {
  const { open, onToggle } = useDisclosure()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  // Dark mode colors
  const headerBg = useColorModeValue('rgba(255, 255, 255, 0.9)', 'rgba(24, 24, 27, 0.95)')
  const borderColor = useColorModeValue('#F4F4F5', '#27272A')
  const logoTextColor = useColorModeValue('#18181B', '#FAFAFA')
  const navColor = useColorModeValue('#52525B', '#A1A1AA')
  const navActiveColor = useColorModeValue('#2563EB', '#60A5FA')
  const navActiveBg = useColorModeValue('#EFF6FF', 'rgba(59, 130, 246, 0.15)')
  const navHoverBg = useColorModeValue('#EFF6FF', 'rgba(59, 130, 246, 0.1)')
  const mobileBg = useColorModeValue('white', '#18181B')
  const signOutBg = useColorModeValue('white', '#27272A')
  const signOutBorder = useColorModeValue('#E4E4E7', '#3F3F46')
  const signOutHoverBg = useColorModeValue('#FAFAFA', '#3F3F46')
  const hamburgerColor = useColorModeValue('#52525B', '#A1A1AA')

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
      color={isActive(to) ? navActiveColor : navColor}
      bg={isActive(to) ? navActiveBg : 'transparent'}
      _hover={{
        color: navActiveColor,
        bg: navHoverBg,
      }}
      transition="all 0.15s"
    >
      {children}
    </Box>
  )

  return (
    <Box
      as="header"
      bg={headerBg}
      backdropFilter="blur(12px)"
      borderBottom="1px solid"
      borderColor={borderColor}
      position="sticky"
      top="0"
      zIndex="100"
    >
      <Flex
        w="100%"
        maxW="1200px"
        mx="auto"
        px={{ base: 4, md: 8 }}
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
            color={logoTextColor}
            letterSpacing="-0.02em"
          >
            BudgetWise
          </Heading>
        </Flex>

        {/* Desktop Navigation */}
        <HStack as="nav" gap={1} display={{ base: 'none', lg: 'flex' }} flexShrink={1} overflow="hidden">
          {user && (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/budget">Budget</NavLink>
              <NavLink to="/recurring">Recurring</NavLink>
              <NavLink to="/reports">Report</NavLink>
              <NavLink to="/transactions">Transactions</NavLink>
              <NavLink to="/import">Import</NavLink>
              <NavLink to="/categories">Categories</NavLink>
              <NavLink to="/assets-liabilities">Assets</NavLink>
            </>
          )}
        </HStack>

        {/* Desktop Auth Button + Dark Mode Toggle */}
        <HStack gap={3} display={{ base: 'none', lg: 'flex' }}>
          <ColorModeButton />
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
              bg={signOutBg}
              color={navColor}
              fontWeight="500"
              borderRadius="8px"
              border="1px solid"
              borderColor={signOutBorder}
              _hover={{ bg: signOutHoverBg, borderColor: signOutBorder }}
              transition="all 0.15s"
            >
              Sign Out
            </Button>
          )}
        </HStack>

        {/* Mobile: Dark Mode + Menu Button */}
        <HStack gap={1} display={{ base: 'flex', lg: 'none' }}>
          <ColorModeButton />
          <IconButton
            onClick={onToggle}
            variant="ghost"
            aria-label="Toggle navigation"
            size="sm"
            borderRadius="8px"
            _hover={{ bg: navHoverBg }}
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
                bg={hamburgerColor}
                borderRadius="full"
                transform={open ? 'rotate(45deg) translateY(6px)' : 'none'}
                transition="all 0.2s"
              />
              <Box
                h="2px"
                bg={hamburgerColor}
                borderRadius="full"
                opacity={open ? 0 : 1}
                transition="all 0.2s"
              />
              <Box
                h="2px"
                bg={hamburgerColor}
                borderRadius="full"
                transform={open ? 'rotate(-45deg) translateY(-6px)' : 'none'}
                transition="all 0.2s"
              />
            </Box>
          </IconButton>
        </HStack>
      </Flex>

      {/* Mobile Navigation */}
      {open && (
        <Box
          display={{ base: 'block', lg: 'none' }}
          bg={mobileBg}
          borderTop="1px solid"
          borderColor={borderColor}
          shadow="lg"
        >
          <Stack maxW="1200px" mx="auto" px={{ base: 4, md: 8 }} py={4} gap={1}>
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
                <MobileNavLink to="/dashboard" active={isActive('/dashboard')} onClick={onToggle} colors={{ navColor, navActiveColor, navActiveBg, navHoverBg }}>
                  Dashboard
                </MobileNavLink>
                <MobileNavLink to="/budget" active={isActive('/budget')} onClick={onToggle} colors={{ navColor, navActiveColor, navActiveBg, navHoverBg }}>
                  Budget
                </MobileNavLink>
                <MobileNavLink to="/recurring" active={isActive('/recurring')} onClick={onToggle} colors={{ navColor, navActiveColor, navActiveBg, navHoverBg }}>
                  Recurring
                </MobileNavLink>
                <MobileNavLink to="/reports" active={isActive('/reports')} onClick={onToggle} colors={{ navColor, navActiveColor, navActiveBg, navHoverBg }}>
                  Report
                </MobileNavLink>
                <MobileNavLink to="/transactions" active={isActive('/transactions')} onClick={onToggle} colors={{ navColor, navActiveColor, navActiveBg, navHoverBg }}>
                  Transactions
                </MobileNavLink>
                <MobileNavLink to="/import" active={isActive('/import')} onClick={onToggle} colors={{ navColor, navActiveColor, navActiveBg, navHoverBg }}>
                  Import
                </MobileNavLink>
                <MobileNavLink to="/categories" active={isActive('/categories')} onClick={onToggle} colors={{ navColor, navActiveColor, navActiveBg, navHoverBg }}>
                  Categories
                </MobileNavLink>
                <MobileNavLink to="/assets-liabilities" active={isActive('/assets-liabilities')} onClick={onToggle} colors={{ navColor, navActiveColor, navActiveBg, navHoverBg }}>
                  Assets & Liabilities
                </MobileNavLink>
                <Box pt={3} borderTop="1px solid" borderColor={borderColor} mt={2}>
                  <Button
                    onClick={() => {
                      handleSignOut()
                      onToggle()
                    }}
                    w="100%"
                    size="md"
                    bg={signOutHoverBg}
                    color={navColor}
                    fontWeight="500"
                    borderRadius="10px"
                    _hover={{ bg: navHoverBg }}
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

const MobileNavLink = ({ to, children, active, onClick, colors }) => (
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
    color={active ? colors.navActiveColor : colors.navColor}
    bg={active ? colors.navActiveBg : 'transparent'}
    _hover={{
      bg: colors.navHoverBg,
      color: colors.navActiveColor,
    }}
    transition="all 0.15s"
  >
    {children}
  </Box>
)

export default Header
