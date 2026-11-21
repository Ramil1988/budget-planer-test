import { useEffect, useRef } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Flex, Grid, IconButton, Text, useDisclosure } from '@chakra-ui/react'
import {
  LuBookOpen,
  LuChartColumn,
  LuLandmark,
  LuLayoutDashboard,
  LuList,
  LuMenu,
  LuRepeat,
  LuSettings,
  LuWallet,
  LuX,
} from 'react-icons/lu'
import { useAuth } from '../contexts/AuthContext'
import { ColorModeButton, useColorModeValue } from './ui/color-mode'

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LuLayoutDashboard },
  { to: '/budget', label: 'Budget', icon: LuWallet },
  { to: '/recurring', label: 'Recurring', icon: LuRepeat },
  { to: '/reports', label: 'Reports', icon: LuChartColumn },
  { to: '/assets-liabilities', label: 'Assets', mobileLabel: 'Assets & Liabilities', icon: LuLandmark },
  { to: '/transactions', label: 'Transactions', icon: LuList, related: ['/add-transaction'] },
  { to: '/settings', label: 'Settings', icon: LuSettings, related: ['/import', '/categories'] },
]

const lightColors = {
  surface: '#FBFCF8',
  border: '#DDE7DF',
  text: '#46574E',
  brand: '#123F35',
  mark: '#145446',
  markText: '#F0F8F1',
  active: '#124D3F',
  activeBg: '#E5F2EA',
  hoverBg: '#EEF4EF',
  focus: '#19705B',
}

const darkColors = {
  surface: '#151E1A',
  border: '#2B3B34',
  text: '#B9CAC1',
  brand: '#EDF7EF',
  mark: '#BFE7CD',
  markText: '#123F35',
  active: '#C6EBD1',
  activeBg: '#203D31',
  hoverBg: '#24332C',
  focus: '#A2D7AF',
}

export default function Header() {
  const { open, onToggle, onClose } = useDisclosure()
  const menuButton = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const colors = useColorModeValue(lightColors, darkColors)

  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  const focusStyle = {
    outline: '2px solid',
    outlineColor: colors.focus,
    outlineOffset: '2px',
  }

  const handleKeyDown = (event) => {
    if (!open || event.key !== 'Escape') return
    event.preventDefault()
    onClose()
    menuButton.current?.focus()
  }

  const handleSignOut = async () => {
    onClose()
    await signOut()
    navigate('/')
  }

  return (
    <Box
      as="header"
      bg={colors.surface}
      borderBottom="1px solid"
      borderColor={colors.border}
      position="sticky"
      top="0"
      zIndex="100"
      pt="env(safe-area-inset-top, 0px)"
      onKeyDown={handleKeyDown}
    >
      <Grid
        maxW="1200px"
        mx="auto"
        px={{ base: 4, md: 8 }}
        templateColumns={{ base: '1fr auto', lg: 'auto minmax(0, 1fr) auto' }}
        alignItems="center"
        columnGap={{ base: 2, lg: 4 }}
      >
        <Flex
          as={RouterLink}
          to="/"
          onClick={onClose}
          gridColumn="1"
          gridRow="1"
          align="center"
          justifySelf="start"
          gap={2.5}
          borderRadius="10px"
          _focusVisible={focusStyle}
        >
          <Flex
            aria-hidden="true"
            align="center"
            justify="center"
            boxSize="36px"
            borderRadius="10px"
            bg={colors.mark}
            color={colors.markText}
            fontSize="20px"
          >
            <LuBookOpen />
          </Flex>
          <Text
            color={colors.brand}
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontSize="18px"
            fontWeight="800"
            letterSpacing="-0.045em"
          >
            BudgetWise
          </Text>
        </Flex>

        <Flex
          gridColumn={{ base: 2, lg: 3 }}
          gridRow="1"
          align="center"
          gap={1}
          minH={{ base: '64px', lg: '68px' }}
        >
          <ColorModeButton
            boxSize={{ base: '44px', lg: '36px' }}
            color={colors.text}
            borderRadius="10px"
            _hover={{ bg: colors.hoverBg, color: colors.brand }}
            _focusVisible={focusStyle}
          />
          <IconButton
            ref={menuButton}
            display={{ base: 'inline-flex', lg: 'none' }}
            variant="ghost"
            boxSize="44px"
            borderRadius="10px"
            color={open ? colors.active : colors.text}
            bg={open ? colors.activeBg : undefined}
            aria-label="Toggle navigation"
            aria-expanded={open}
            aria-controls="main-navigation"
            onClick={onToggle}
            _hover={{ bg: colors.hoverBg, color: colors.brand }}
            _focusVisible={focusStyle}
          >
            {open ? <LuX aria-hidden="true" /> : <LuMenu aria-hidden="true" />}
          </IconButton>
        </Flex>

        <Flex
          as="nav"
          id="main-navigation"
          aria-label="Main navigation"
          display={{ base: open ? 'flex' : 'none', lg: 'flex' }}
          gridColumn={{ base: '1 / -1', lg: 2 }}
          gridRow={{ base: 2, lg: 1 }}
          direction={{ base: 'column', lg: 'row' }}
          align={{ base: 'stretch', lg: 'center' }}
          justify={{ base: 'flex-start', lg: 'flex-end' }}
          gap={{ base: 3, lg: 4 }}
          borderTopWidth={{ base: '1px', lg: 0 }}
          borderColor={colors.border}
          pt={{ base: 3, lg: 0 }}
          pb={{ base: 4, lg: 0 }}
          maxH={{ base: 'calc(100dvh - 64px - env(safe-area-inset-top, 0px))', lg: 'none' }}
          overflowY={{ base: 'auto', lg: 'visible' }}
          overscrollBehaviorY={{ base: 'contain', lg: 'auto' }}
        >
          {user && (
            <Flex
              direction={{ base: 'column', lg: 'row' }}
              justify={{ lg: 'center' }}
              flex="1"
              gap={1}
              p={{ base: '4px', lg: 0 }}
              m={{ base: '-4px', lg: 0 }}
            >
              {navigation.map(({ to, label, mobileLabel, icon: Icon, related }) => {
                const matchesPage = location.pathname === to
                const matchesSection = related?.includes(location.pathname)
                const active = matchesPage || matchesSection
                const current = matchesPage ? 'page' : 'location'

                return (
                  <Flex
                    key={to}
                    as={RouterLink}
                    to={to}
                    onClick={onClose}
                    aria-current={active ? current : undefined}
                    align="center"
                    gap={3}
                    minH={{ base: '44px', lg: '36px' }}
                    px={{ base: 3, lg: 2.5 }}
                    borderRadius="9px"
                    color={active ? colors.active : colors.text}
                    bg={active ? colors.activeBg : undefined}
                    fontWeight={active ? '700' : '600'}
                    fontSize="sm"
                    whiteSpace="nowrap"
                    _hover={{ bg: active ? colors.activeBg : colors.hoverBg, color: colors.active }}
                    _focusVisible={focusStyle}
                  >
                    <Box as="span" aria-hidden="true" display={{ base: 'inline-flex', lg: 'none' }} fontSize="18px">
                      <Icon />
                    </Box>
                    {mobileLabel ? (
                      <>
                        <Box as="span" display={{ base: 'none', lg: 'inline' }}>{label}</Box>
                        <Box as="span" display={{ base: 'inline', lg: 'none' }}>{mobileLabel}</Box>
                      </>
                    ) : label}
                  </Flex>
                )
              })}
            </Flex>
          )}

          {user ? (
            <Button
              onClick={handleSignOut}
              minH={{ base: '44px', lg: '36px' }}
              variant="outline"
              borderColor={colors.border}
              borderRadius="9px"
              color={colors.text}
              fontWeight="600"
              fontSize="sm"
              _hover={{ bg: colors.hoverBg, color: colors.brand }}
              _focusVisible={focusStyle}
            >
              Sign Out
            </Button>
          ) : (
            <Button
              asChild
              minH={{ base: '44px', lg: '36px' }}
              bg={colors.mark}
              color={colors.markText}
              borderRadius="9px"
              fontWeight="700"
              fontSize="sm"
              _hover={{ opacity: 0.9 }}
              _focusVisible={focusStyle}
            >
              <RouterLink to="/login" onClick={onClose}>Sign In</RouterLink>
            </Button>
          )}
        </Flex>
      </Grid>
    </Box>
  )
}
