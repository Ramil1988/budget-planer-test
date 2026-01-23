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
 * CategoryAutocomplete - Shows existing categories that match what you're typing
 * Helps prevent duplicate categories and shows similar ones
 *
 * Props:
 * - value: Current input value
 * - onChange: Callback when value changes
 * - categories: Array of category objects { id, name, type }
 * - placeholder: Input placeholder text
 * - onKeyPress: Key press handler (for Enter to submit)
 * - ...inputProps: Additional props passed to Input
 */
export default function CategoryAutocomplete({
  value,
  onChange,
  categories = [],
  placeholder = "Category name",
  onKeyPress,
  ...inputProps
}) {
  const colors = useDarkModeColors();
  const [isOpen, setIsOpen] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const listRef = useRef(null);

  // Filter categories when value changes
  useEffect(() => {
    if (!value || value.trim().length < 1) {
      setFilteredCategories([]);
      return;
    }

    const searchTerm = value.toLowerCase().trim();
    const filtered = categories
      .filter(cat => cat.name.toLowerCase().includes(searchTerm))
      .slice(0, 10); // Limit to 10 results

    setFilteredCategories(filtered);
    setHighlightedIndex(-1);
  }, [value, categories]);

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

  const handleSelectCategory = (category) => {
    onChange({ target: { value: category.name } });
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || filteredCategories.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredCategories.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        if (highlightedIndex >= 0) {
          e.preventDefault();
          handleSelectCategory(filteredCategories[highlightedIndex]);
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

  // Check if exact match exists
  const exactMatch = categories.find(
    cat => cat.name.toLowerCase() === value?.toLowerCase()?.trim()
  );

  return (
    <Box position="relative" w="100%" flex={1}>
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        autoComplete="off"
        {...inputProps}
      />

      {/* Dropdown */}
      {isOpen && filteredCategories.length > 0 && (
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
          maxH="240px"
          overflowY="auto"
        >
          {/* Header showing this is existing categories */}
          <Box px={3} py={2} borderBottomWidth="1px" borderColor={colors.borderSubtle}>
            <Text fontSize="xs" color={colors.textMuted} fontWeight="medium">
              Existing categories matching "{value}"
            </Text>
          </Box>

          <VStack ref={listRef} gap={0} align="stretch" p={1}>
            {filteredCategories.map((category, index) => {
              const isHighlighted = index === highlightedIndex;
              const isExactMatch = category.name.toLowerCase() === value?.toLowerCase()?.trim();

              return (
                <HStack
                  key={category.id}
                  px={3}
                  py={2}
                  cursor="pointer"
                  bg={isHighlighted ? colors.rowStripedBg : 'transparent'}
                  _hover={{ bg: colors.rowStripedBg }}
                  borderRadius="8px"
                  onClick={() => handleSelectCategory(category)}
                  justify="space-between"
                  transition="background 0.1s"
                >
                  <Text
                    color={colors.textPrimary}
                    fontSize="sm"
                    fontWeight={isExactMatch ? "bold" : "normal"}
                  >
                    {category.name}
                  </Text>
                  <HStack gap={2}>
                    <Badge
                      colorScheme={category.type === 'income' ? 'green' : 'red'}
                      fontSize="xs"
                      px={2}
                      py={0.5}
                      borderRadius="full"
                    >
                      {category.type}
                    </Badge>
                    {isExactMatch && (
                      <Badge
                        colorScheme="orange"
                        fontSize="xs"
                        px={2}
                        py={0.5}
                        borderRadius="full"
                      >
                        exists
                      </Badge>
                    )}
                  </HStack>
                </HStack>
              );
            })}
          </VStack>

          {/* Warning if exact match exists */}
          {exactMatch && (
            <Box px={3} py={2} borderTopWidth="1px" borderColor={colors.borderSubtle} bg={colors.warningBg}>
              <Text fontSize="xs" color={colors.warning} textAlign="center">
                This category already exists
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
