# Technical Reference

**Last Updated:** 2026-01-20

This document provides technical guidelines, code patterns, and quick references for developing BudgetWise.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Code Style Guidelines](#code-style-guidelines)
3. [Component Patterns](#component-patterns)
4. [Chakra UI Usage](#chakra-ui-usage)
5. [Routing Patterns](#routing-patterns)
6. [State Management](#state-management)
7. [Testing Guidelines](#testing-guidelines)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)

---

## Development Setup

### Prerequisites
- Node.js 18+ (recommended: latest LTS)
- pnpm 10.24.0+ (package manager)

### Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd budget-planner

# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

### Environment
- Dev server runs on: http://localhost:5173
- Hot Module Replacement (HMR) enabled
- React DevTools compatible

---

## Code Style Guidelines

### File Naming
- Components: PascalCase (e.g., `Header.jsx`, `BudgetForm.jsx`)
- Utilities: camelCase (e.g., `formatCurrency.js`, `dateHelpers.js`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS.js`)

### Component Structure
```jsx
// 1. Imports
import { useState, useEffect } from 'react'
import { Box, Heading, Text } from '@chakra-ui/react'

// 2. Component definition
function MyComponent({ title, children }) {
  // 3. Hooks (state, effects, etc.)
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Effect logic
  }, [])

  // 4. Event handlers
  const handleClick = () => {
    setCount(count + 1)
  }

  // 5. Helper functions
  const formatCount = (num) => {
    return num.toString().padStart(2, '0')
  }

  // 6. Render
  return (
    <Box>
      <Heading>{title}</Heading>
      <Text onClick={handleClick}>
        Count: {formatCount(count)}
      </Text>
      {children}
    </Box>
  )
}

// 7. Export
export default MyComponent
```

### Code Formatting
- Use 2 spaces for indentation
- Single quotes for strings (except JSX attributes)
- Semicolons optional but be consistent
- Max line length: 100 characters (guideline, not strict)

---

## Component Patterns

### Page Component Template
```jsx
import { Box, Container, Heading } from '@chakra-ui/react'

function MyPage() {
  return (
    <Box as="main">
      <Container maxW="1200px" px={8}>
        {/* Page content */}
        <Heading>Page Title</Heading>
      </Container>
    </Box>
  )
}

export default MyPage
```

### Reusable UI Component Template
```jsx
import { Box, Button } from '@chakra-ui/react'

function Card({ title, children, onAction }) {
  return (
    <Box
      p={6}
      bg="white"
      borderRadius="md"
      shadow="md"
      _hover={{ shadow: 'lg' }}
    >
      <Heading size="md" mb={4}>{title}</Heading>
      {children}
      {onAction && (
        <Button mt={4} onClick={onAction}>
          Action
        </Button>
      )}
    </Box>
  )
}

export default Card
```

### Form Component Pattern
```jsx
import { useState } from 'react'
import { Box, FormControl, FormLabel, Input, Button } from '@chakra-ui/react'

function MyForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <Box as="form" onSubmit={handleSubmit}>
      <FormControl mb={4}>
        <FormLabel>Name</FormLabel>
        <Input
          name="name"
          value={formData.name}
          onChange={handleChange}
        />
      </FormControl>

      <FormControl mb={4}>
        <FormLabel>Email</FormLabel>
        <Input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
        />
      </FormControl>

      <Button type="submit" colorScheme="blue">
        Submit
      </Button>
    </Box>
  )
}

export default MyForm
```

---

## Chakra UI Usage

### Common Components

#### Layout Components
```jsx
import {
  Box,          // Generic container (like <div>)
  Flex,         // Flexbox container
  Grid,         // CSS Grid container
  Container,    // Centered container with max-width
  Stack,        // Vertical stack (flex column)
  HStack,       // Horizontal stack (flex row)
  VStack,       // Vertical stack with centering
  SimpleGrid    // Responsive grid
} from '@chakra-ui/react'
```

#### Typography
```jsx
import {
  Heading,      // h1-h6 headings
  Text          // Paragraphs and text
} from '@chakra-ui/react'

// Usage
<Heading as="h1" size="2xl">Title</Heading>
<Heading as="h2" size="lg">Subtitle</Heading>
<Text fontSize="lg" color="gray.600">Body text</Text>
```

#### Buttons
```jsx
import { Button, IconButton } from '@chakra-ui/react'

// Variants
<Button colorScheme="blue">Primary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// Icon Button
<IconButton
  icon={<Icon />}
  aria-label="Action"
  colorScheme="blue"
/>
```

### Responsive Design
```jsx
// Object syntax for responsive props
<Box
  fontSize={{ base: 'sm', md: 'md', lg: 'lg' }}
  p={{ base: 4, md: 6, lg: 8 }}
  display={{ base: 'block', md: 'flex' }}
>
  Content
</Box>

// Array syntax (deprecated in v3, use object)
// fontSize={['sm', 'md', 'lg']}
```

### Styling Props
```jsx
<Box
  // Layout
  w="100%"              // width
  h="200px"             // height
  maxW="1200px"         // max-width
  m={4}                 // margin (all sides)
  mt={2}                // margin-top
  p={6}                 // padding (all sides)

  // Flexbox
  display="flex"
  align="center"        // align-items
  justify="space-between" // justify-content
  gap={4}               // gap

  // Colors
  bg="gray.50"          // background
  color="blue.600"      // text color

  // Borders
  border="1px"
  borderColor="gray.200"
  borderRadius="md"

  // Shadow
  shadow="md"

  // Pseudo-states
  _hover={{ bg: 'gray.100' }}
  _focus={{ outline: '2px solid blue' }}
>
  Content
</Box>
```

### Color Palette Reference
```jsx
// Gray Scale
gray.50, gray.100, gray.200, gray.300, gray.400,
gray.500, gray.600, gray.700, gray.800, gray.900

// Primary Colors
blue.50 to blue.900
red.50 to red.900
green.50 to green.900
yellow.50 to yellow.900

// Common Usage
bg="white"          // White background
bg="gray.50"        // Light gray background
color="gray.600"    // Secondary text
color="blue.600"    // Primary blue
border="1px"        // 1px border
borderColor="gray.200"
```

### Spacing Scale
```jsx
// Chakra's spacing scale (1 unit = 0.25rem = 4px)
0   // 0px
1   // 4px
2   // 8px
4   // 16px
6   // 24px
8   // 32px
12  // 48px
16  // 64px

// Usage
<Box p={4}>16px padding</Box>
<Box mt={8} mb={4}>32px top, 16px bottom margin</Box>
```

---

## Routing Patterns

### Adding a New Route
```jsx
// 1. Create page component
// src/pages/NewPage.jsx
function NewPage() {
  return <div>New Page</div>
}
export default NewPage

// 2. Add route to App.jsx
import NewPage from './pages/NewPage'

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/new-page" element={<NewPage />} /> {/* Add this */}
      </Routes>
      <Footer />
    </>
  )
}

// 3. Add navigation link in Header.jsx
<Box as={RouterLink} to="/new-page">
  New Page
</Box>
```

### Dynamic Routes
```jsx
// App.jsx
<Route path="/budget/:id" element={<BudgetDetail />} />

// BudgetDetail.jsx
import { useParams } from 'react-router-dom'

function BudgetDetail() {
  const { id } = useParams()
  return <div>Budget ID: {id}</div>
}
```

### Programmatic Navigation
```jsx
import { useNavigate } from 'react-router-dom'

function MyComponent() {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate('/features')
  }

  return <Button onClick={handleClick}>Go to Features</Button>
}
```

---

## State Management

### Local Component State
```jsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)

  const increment = () => setCount(count + 1)
  const decrement = () => setCount(count - 1)

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  )
}
```

### Context API Pattern (Recommended for Budget Data)
```jsx
// contexts/BudgetContext.jsx
import { createContext, useContext, useState } from 'react'

const BudgetContext = createContext()

export function BudgetProvider({ children }) {
  const [budgets, setBudgets] = useState([])

  const addBudget = (budget) => {
    setBudgets(prev => [...prev, budget])
  }

  const deleteBudget = (id) => {
    setBudgets(prev => prev.filter(b => b.id !== id))
  }

  const value = {
    budgets,
    addBudget,
    deleteBudget
  }

  return (
    <BudgetContext.Provider value={value}>
      {children}
    </BudgetContext.Provider>
  )
}

export function useBudget() {
  const context = useContext(BudgetContext)
  if (!context) {
    throw new Error('useBudget must be used within BudgetProvider')
  }
  return context
}

// Usage in main.jsx
import { BudgetProvider } from './contexts/BudgetContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BudgetProvider>
    <App />
  </BudgetProvider>
)

// Usage in components
import { useBudget } from '../contexts/BudgetContext'

function BudgetList() {
  const { budgets, addBudget } = useBudget()

  return <div>{budgets.map(b => <div key={b.id}>{b.name}</div>)}</div>
}
```

### Local Storage Persistence
```jsx
import { useState, useEffect } from 'react'

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : initialValue
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

// Usage
function MyComponent() {
  const [budgets, setBudgets] = useLocalStorage('budgets', [])

  return <div>{budgets.length} budgets</div>
}
```

---

## Testing Guidelines

### Component Test Template
```jsx
// Header.test.jsx
import { test, expect } from '@playwright/test'

test.describe('Header Component', () => {
  test('should display logo', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await expect(page.locator('.logo')).toBeVisible()
  })

  test('should navigate to features page', async ({ page }) => {
    await page.goto('http://localhost:5173')
    await page.click('text=Features')
    await expect(page).toHaveURL(/.*features/)
  })
})
```

### Running Tests
```bash
pnpm test              # Run all tests
pnpm test:ui           # Interactive UI mode
pnpm test:headed       # See browser window
pnpm test:debug        # Debug mode
pnpm test:report       # View HTML report
```

---

## Common Tasks

### Add a New Component
```bash
# 1. Create file
touch src/components/MyComponent.jsx

# 2. Write component (see templates above)

# 3. Import and use
import MyComponent from './components/MyComponent'
```

### Add a New Page
```bash
# 1. Create file
touch src/pages/MyPage.jsx

# 2. Add route in App.jsx
# 3. Add navigation link in Header.jsx
```

### Install New Dependency
```bash
pnpm add <package-name>      # Production dependency
pnpm add -D <package-name>   # Dev dependency
```

### Create Custom Hook
```jsx
// hooks/useWindowSize.js
import { useState, useEffect } from 'react'

export function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return size
}

// Usage
import { useWindowSize } from '../hooks/useWindowSize'

function MyComponent() {
  const { width, height } = useWindowSize()
  return <div>Window: {width} x {height}</div>
}
```

### Update Transactions by Merchant Mapping
```jsx
// Pattern: Update existing transactions when a merchant mapping changes
const updateTransactionsByMerchant = async (merchantName, categoryName, transactionType = 'expense') => {
  // 1. Get the category ID for the new category
  const targetCategory = categories.find(c => c.name === categoryName && c.type === transactionType);
  if (!targetCategory) return { updated: 0, error: 'Category not found' };

  // 2. Fetch transactions matching merchant name (case-insensitive substring match)
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, description, category_id')
    .eq('user_id', user.id)
    .eq('type', transactionType)
    .ilike('description', `%${merchantName}%`);

  // 3. Filter out already correctly categorized
  const transactionsToUpdate = (transactions || []).filter(
    t => t.category_id !== targetCategory.id
  );

  // 4. Update in batches
  const batchSize = 100;
  for (let i = 0; i < transactionsToUpdate.length; i += batchSize) {
    const batchIds = transactionsToUpdate.slice(i, i + batchSize).map(t => t.id);
    await supabase
      .from('transactions')
      .update({ category_id: targetCategory.id })
      .in('id', batchIds);
  }

  return { updated: transactionsToUpdate.length };
};

// Usage: When adding a new merchant mapping
if (updateExistingTransactionsCheckbox) {
  const result = await updateTransactionsByMerchant(merchantName, selectedCategory, 'expense');
  console.log(`Updated ${result.updated} transactions`);
}
```

### Re-categorize All Transactions
```jsx
// Pattern: Apply all merchant mappings to re-categorize all transactions
const handleRecategorizeAll = async () => {
  // 1. Fetch all merchant mappings
  const { data: mappings } = await supabase
    .from('merchant_mappings')
    .select('transaction_description, category_name')
    .eq('user_id', user.id);

  // 2. Build category lookup maps (name -> id)
  const expenseCategoryMap = {};
  const incomeCategoryMap = {};
  categories.forEach(cat => {
    if (cat.type === 'income') {
      incomeCategoryMap[cat.name] = cat.id;
    } else {
      expenseCategoryMap[cat.name] = cat.id;
    }
  });

  // 3. Fetch all transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, description, type, category_id')
    .eq('user_id', user.id);

  // 4. Match each transaction to mappings (first match wins)
  const updates = [];
  for (const transaction of transactions || []) {
    const normalizedDesc = transaction.description.toUpperCase().trim();
    const categoryMap = transaction.type === 'income' ? incomeCategoryMap : expenseCategoryMap;

    for (const mapping of mappings || []) {
      if (normalizedDesc.includes(mapping.transaction_description)) {
        const newCategoryId = categoryMap[mapping.category_name];
        if (newCategoryId && newCategoryId !== transaction.category_id) {
          updates.push({ id: transaction.id, category_id: newCategoryId });
        }
        break; // First match wins
      }
    }
  }

  // 5. Update transactions
  for (const update of updates) {
    await supabase
      .from('transactions')
      .update({ category_id: update.category_id })
      .eq('id', update.id);
  }

  return { updated: updates.length };
};
```

---

## Troubleshooting

### Common Issues

#### 1. Vite Dev Server Won't Start
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install --force
```

#### 2. esbuild Platform Error (macOS ARM64)
```bash
# Ensure correct versions in package.json
"esbuild": "0.27.1",
"@esbuild/darwin-arm64": "0.27.1"

# Reinstall
pnpm install --force
```

#### 3. Chakra UI Component Not Working
- Check imports: ensure importing from '@chakra-ui/react'
- Verify ChakraProvider wraps your app in main.jsx
- Check Chakra UI v3 docs for API changes

#### 4. React Router Links Not Working
- Ensure using `as={RouterLink}` with Chakra Box
- Or use `Link` from 'react-router-dom'
- Verify BrowserRouter wraps Routes

#### 5. Styles Not Updating
- Clear Vite cache: `rm -rf node_modules/.vite`
- Hard reload: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### Debug Tools

#### React DevTools
- Install browser extension
- Inspect component tree
- View props and state

#### Vite DevTools
- Network tab: Check HMR updates
- Console: Check for errors
- Sources: Set breakpoints

---

## Best Practices

### Performance
- Use React.memo for expensive components
- Lazy load routes: `const Page = lazy(() => import('./Page'))`
- Optimize images (WebP format, proper sizing)
- Code splitting for large components

### Accessibility
- Use semantic HTML (`as="main"`, `as="nav"`, etc.)
- Provide `aria-label` for icon buttons
- Ensure keyboard navigation works
- Maintain color contrast ratios

### Security
- Sanitize user inputs
- Use HTTPS in production
- Keep dependencies updated
- Don't commit secrets

### Code Organization
- One component per file
- Group related files in folders
- Use barrel exports (index.js) for clean imports
- Keep components small and focused

---

## Additional Resources

### Documentation Links
- [Chakra UI v3 Docs](https://chakra-ui.com/docs)
- [React Docs](https://react.dev)
- [React Router Docs](https://reactrouter.com)
- [Vite Docs](https://vitejs.dev)
- [Playwright Docs](https://playwright.dev)

### Useful VS Code Extensions
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint
- Chakra UI Snippets

---

**Note:** This reference will be updated as new patterns and best practices emerge in the project.
