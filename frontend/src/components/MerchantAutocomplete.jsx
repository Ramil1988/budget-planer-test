import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Input,
  VStack,
  HStack,
  Text,
  Badge,
} from '@chakra-ui/react';
import { useDarkModeColors } from '../lib/useDarkModeColors';

/**
 * MerchantAutocomplete - A searchable dropdown for selecting merchants
 *
 * Props:
 * - value: Current input value
 * - onChange: Callback when value changes (receives event-like object)
 * - onSelect: Callback when a merchant is selected from dropdown
 * - merchants: Array of merchant names
 * - merchantCategoryMap: Object mapping merchant names to their categories { merchantName: categoryName }
 * - placeholder: Input placeholder text
 * - size: Input size (sm, md, lg)
 * - ...inputProps: Additional props passed to Input
 */
export default function MerchantAutocomplete({
  value,
  onChange,
  onSelect,
  merchants = [],
  merchantCategoryMap = {},
  placeholder = "Search merchants...",
  size = "lg",
  onKeyPress,
  ...inputProps
}) {
  const colors = useDarkModeColors();
  const [isOpen, setIsOpen] = useState(false);
  const [filteredMerchants, setFilteredMerchants] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const listRef = useRef(null);

  // Filter merchants when value changes
  useEffect(() => {
    if (!value || value.trim().length < 1) {
      setFilteredMerchants([]);
      return;
    }

    const searchTerm = value.toUpperCase().trim();
    const filtered = merchants
      .filter(m => m.toUpperCase().includes(searchTerm))
      .slice(0, 50); // Limit to 50 results for performance

    setFilteredMerchants(filtered);
    setHighlightedIndex(-1);
  }, [value, merchants]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e) => {
    onChange(e);
    setIsOpen(true);
  };

  const handleFocus = () => {
    if (value && value.trim().length >= 1) {
      setIsOpen(true);
    }
  };

  const handleSelectMerchant = (merchant) => {
    // Create a synthetic event-like object
    onChange({ target: { value: merchant } });
    if (onSelect) {
      onSelect(merchant);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || filteredMerchants.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredMerchants.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        if (highlightedIndex >= 0) {
          e.preventDefault();
          handleSelectMerchant(filteredMerchants[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleKeyPress = (e) => {
    // Only trigger onKeyPress if dropdown is closed or no selection
    if (onKeyPress && (!isOpen || highlightedIndex < 0)) {
      onKeyPress(e);
    }
  };

  return (
    <Box position="relative" w="100%">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        size={size}
        autoComplete="off"
        {...inputProps}
      />

      {/* Dropdown */}
      {isOpen && filteredMerchants.length > 0 && (
        <Box
          ref={dropdownRef}
          position="absolute"
          top="100%"
          left={0}
          right={0}
          zIndex={1000}
          mt={1}
          bg={colors.cardBg}
          borderWidth="1px"
          borderColor={colors.borderColor}
          borderRadius="12px"
          boxShadow="lg"
          maxH="280px"
          overflowY="auto"
          overflowX="hidden"
        >
          <VStack ref={listRef} gap={0} align="stretch" p={1}>
            {filteredMerchants.map((merchant, index) => {
              const category = merchantCategoryMap[merchant];
              const isHighlighted = index === highlightedIndex;

              return (
                <HStack
                  key={merchant}
                  px={3}
                  py={2}
                  cursor="pointer"
                  bg={isHighlighted ? colors.rowStripedBg : 'transparent'}
                  _hover={{ bg: colors.rowStripedBg }}
                  borderRadius="8px"
                  onClick={() => handleSelectMerchant(merchant)}
                  justify="space-between"
                  transition="background 0.1s"
                >
                  <Text
                    color={colors.textPrimary}
                    fontSize="sm"
                    noOfLines={1}
                    flex={1}
                  >
                    {merchant}
                  </Text>
                  {category && (
                    <Badge
                      colorScheme="gray"
                      fontSize="xs"
                      px={2}
                      py={0.5}
                      borderRadius="full"
                      ml={2}
                      flexShrink={0}
                    >
                      {category}
                    </Badge>
                  )}
                </HStack>
              );
            })}
          </VStack>

          {/* Show count if there are more results */}
          {filteredMerchants.length >= 50 && (
            <Box px={3} py={2} borderTopWidth="1px" borderColor={colors.borderSubtle}>
              <Text fontSize="xs" color={colors.textMuted} textAlign="center">
                Showing first 50 results. Type more to narrow down.
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* No results message */}
      {isOpen && value && value.trim().length >= 1 && filteredMerchants.length === 0 && (
        <Box
          ref={dropdownRef}
          position="absolute"
          top="100%"
          left={0}
          right={0}
          zIndex={1000}
          mt={1}
          bg={colors.cardBg}
          borderWidth="1px"
          borderColor={colors.borderColor}
          borderRadius="12px"
          boxShadow="lg"
          p={4}
        >
          <Text fontSize="sm" color={colors.textMuted} textAlign="center">
            No existing merchants match "{value}"
          </Text>
          <Text fontSize="xs" color={colors.textSecondary} textAlign="center" mt={1}>
            This will create a new merchant mapping
          </Text>
        </Box>
      )}
    </Box>
  );
}
