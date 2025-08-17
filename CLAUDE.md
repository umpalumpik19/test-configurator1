# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a mattress configurator React application that allows users to build custom mattresses by selecting different foam layers, covers, sizes, and heights. The application features real-time visual preview, price calculations, URL-based configuration sharing, and a complete shopping cart system with secure checkout.

## Commands

### Development
- `npm start` - Start development server (opens on localhost:3000)
- `npm run build` - Build production bundle
- `npm test` - Run tests in watch mode
- `npm run eject` - Eject from Create React App (one-way operation)

### Testing
- `npm test` - Run all tests in interactive watch mode
- `npm test -- --coverage` - Run tests with coverage report
- `npm test -- --watchAll=false` - Run tests once without watch mode

## Architecture

### Core Data Structure

The application is driven by three main JSON configuration files in `/public/data/`:

1. **layers-config.json** - Defines available mattress layers and covers with pricing
   - `mattressLayers[]` - Array of foam/spring layers with id, name, price, icon, slug
   - `covers[]` - Array of fabric covers with id, name, price, slug, icon

2. **url-mapping.json** - Maps internal IDs to URL-friendly slugs for shareable configurations
   - `layers{}` - Maps layer IDs to URL segments  
   - `covers{}` - Maps cover IDs to URL segments

3. **layer-descriptions.json** - Rich content for each layer type
   - Layer descriptions with images and additional info blocks
   - `staticBlocks[]` - Always-visible content (warranty, etc.)
   - `coverDescriptions{}` - Detailed cover information

### Visual System

Layered mattress visualization using WebP images organized by:
- Height (10cm, 20cm, 30cm)
- Size category (single: <160cm width, double: ≥160cm width)
- Layer position (sloj-odin, sloj-dva, sloj-tri)
- Material slug (matches slug from layers-config.json)

Path structure: `/public/layers/{height}/{size_category}/{layer_key}/{material_slug}.webp`

### Key React Components

**App.js (main component)**
- State management for all selections (size, height, layers, cover)
- URL parsing/generation for shareable configurations
- Price calculation and responsive layout management
- Global card height calculation for consistent UI

**OptionGroup**
- Reusable component for layer/cover selection
- Responsive grid layout with dynamic column calculation
- Image loading with fallback handling

**ShoppingCart (src/components/ShoppingCart.js)**
- Complete shopping cart modal with item management
- Secure checkout form with validation
- Address fields for courier delivery
- Animated transitions and modern UI
- Mobile-responsive design

### State Management

The app uses React hooks for state:
- `selectedOptions` - Object containing selected layer/cover IDs
- `selectedSize` - Mattress dimensions (e.g., "160x200")
- `selectedHeight` - Mattress height (10, 20, or 30cm)
- `globalCardHeight` - Calculated min-height for consistent card sizing
- `cartItems` - Array of items in shopping cart with quantities
- `isCartOpen` - Boolean controlling cart modal visibility

### URL System

Configurations are encoded in URLs as: `/{size}-{height}cm-{layer1}-{layer2}-{layer3}-{cover}`
- Uses friendly slugs from url-mapping.json
- Automatically updates URL on changes
- Parses URL on page load to restore configurations

### Responsive Design

- Mobile-first approach with breakpoint at 1024px (useIsMobile hook)
- Dynamic column calculation based on container width
- Global card height synchronization across all option grids
- ResizeObserver integration for layout recalculation

### Layer Visibility Logic

Layer visibility depends on mattress height:
- 10cm: Only sloj-odin (layer 1)
- 20cm: sloj-odin + sloj-dva (layers 1-2)  
- 30cm: sloj-odin + sloj-dva + sloj-tri (layers 1-3)

## Development Notes

### Adding New Materials
1. Add entry to `layers-config.json` with unique ID, name, price, icon path, slug
2. Add slug mapping to `url-mapping.json` 
3. Add description to `layer-descriptions.json`
4. Add WebP images for all height/size combinations in `/public/layers/`
5. Add icon to `/public/icons/`

### Image Management
- All images are WebP format for optimal loading
- Icons in `/public/icons/` for option cards
- Layer visualizations in `/public/layers/` with specific directory structure
- Error handling included for missing images

### Price Calculation
- Prices from layers-config.json are summed for visible layers + cover
- Real-time updates when selections change
- Formatted in Czech Koruna (Kč) with locale formatting

### Performance Considerations
- ResizeObserver used for efficient layout recalculation
- RequestAnimationFrame for smooth card height updates
- Image lazy loading and error handling
- Memoized calculations for price and descriptions

## Shopping Cart System

### Features
- **Cart Management** - Add, remove, and update item quantities
- **Secure Checkout** - Complete form validation and input sanitization
- **Delivery Options** - Pickup or courier delivery with address fields
- **Payment Methods** - Card, cash, or bank transfer options
- **Responsive Design** - Mobile-optimized modals and forms

### Components Structure
```
src/components/
├── ShoppingCart.js       # Main cart component
└── ShoppingCart.css      # Cart styling with animations
```

### Security Features
- **Input Sanitization** - XSS prevention through HTML tag removal
- **Form Validation** - Real-time validation for all fields
- **Czech Localization** - Phone and postal code format validation
- **Controlled Inputs** - All form data is controlled and sanitized

### Cart Functionality
- **Duplicate Detection** - Prevents duplicate configurations in cart
- **Quantity Management** - Increment/decrement with bounds checking
- **Price Calculation** - Real-time total updates
- **Persistent State** - Cart persists during session

### Styling
- **Dark Theme** - Matches application design system
- **Smooth Animations** - fadeIn/slideUp effects (0.3-0.4s)
- **Modern Buttons** - Gradient backgrounds with hover effects
- **Custom Radio Buttons** - Styled with accent colors
- **Mobile Responsive** - Adaptive layouts for all screen sizes