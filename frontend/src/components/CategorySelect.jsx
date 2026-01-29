import { useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
} from '@chakra-ui/react';
import { useDarkModeColors } from '../lib/useDarkModeColors';

/**
 * CategorySelect - A custom dropdown for selecting categories
 * Similar to MerchantAutocomplete but for category selection with better mobile support
 *
 * Props:
 * - value: Currently selected category name
 * - onChange: Callback when category is selected (receives category name)
 * - categories: Array of category names
 * - placeholder: Placeholder text when nothing selected
 */
export default function CategorySelect({
  value,
  onChange,
  categories = [],
  placeholder = "Select a category...",
}) {
  const colors = useDarkModeColors();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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

  // Reset highlight when opening
  useEffect(() => {
    if (isOpen && value) {
      const index = categories.indexOf(value);
      setHighlightedIndex(index >= 0 ? index : -1);
    }
  }, [isOpen, value, categories]);

  const handleSelect = (category) => {
    onChange(category);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < categories.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(categories[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <Box ref={containerRef} position="relative" w="100%">
      {/* Trigger button */}
      <Box
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        cursor="pointer"
        p={4}
        h="56px"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        borderRadius="12px"
        borderWidth="1px"
        borderColor={isOpen ? 'blue.500' : colors.borderColor}
        bg={colors.rowStripedBg}
        _hover={{ borderColor: 'blue.400' }}
        _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3B82F6', outline: 'none' }}
        transition="all 0.2s"
      >
        <Text
          color={value ? colors.textPrimary : colors.textMuted}
          fontSize="md"
          noOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Box
          as="span"
          transform={isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}
          transition="transform 0.2s"
          color={colors.textSecondary}
        >
          ▼
        </Box>
      </Box>

      {/* Dropdown */}
      {isOpen && (
        <Box
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
          maxH={{ base: '280px', md: '320px' }}
          overflowY="auto"
          overflowX="hidden"
        >
          <VStack ref={listRef} gap={0} align="stretch" p={1} role="listbox">
            {categories.map((category, index) => {
              const isHighlighted = index === highlightedIndex;
              const isSelected = category === value;

              return (
                <HStack
                  key={category}
                  px={3}
                  py={2.5}
                  cursor="pointer"
                  bg={isHighlighted ? colors.rowStripedBg : 'transparent'}
                  _hover={{ bg: colors.rowStripedBg }}
                  borderRadius="8px"
                  onClick={() => handleSelect(category)}
                  justify="space-between"
                  transition="background 0.1s"
                  role="option"
                  aria-selected={isSelected}
                >
                  <Text
                    color={colors.textPrimary}
                    fontSize="sm"
                    fontWeight={isSelected ? '600' : '400'}
                  >
                    {category}
                  </Text>
                  {isSelected && (
                    <Text color="blue.500" fontSize="sm">✓</Text>
                  )}
                </HStack>
              );
            })}
          </VStack>

          {categories.length === 0 && (
            <Box px={3} py={4}>
              <Text fontSize="sm" color={colors.textMuted} textAlign="center">
                No categories available
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
