# 🎨 Component Library Documentation

Dokumentasi lengkap untuk semua reusable UI components di design system.

## Table of Contents

1. [Button](#button)
2. [Card](#card)
3. [Input](#input)
4. [Badge](#badge)
5. [Modal](#modal)
6. [Utility Functions](#utility-functions)

---

## Button

Reusable button component dengan multiple variants dan sizes.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | `primary` \| `secondary` \| `ghost` \| `danger` | `primary` | Button style variant |
| size | `sm` \| `md` \| `lg` | `md` | Button size |
| isLoading | boolean | `false` | Show loading spinner |
| disabled | boolean | `false` | Disable button |
| className | string | - | Additional CSS classes |

### Examples

```jsx
import { Button } from '@/components/ui/Button';

// Primary button (default)
<Button onClick={() => handleSubmit()}>
  Submit
</Button>

// Secondary button
<Button variant="secondary">
  Secondary
</Button>

// Ghost button (transparent background)
<Button variant="ghost">
  Ghost
</Button>

// Danger button
<Button variant="danger">
  Delete
</Button>

// Different sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// Loading state
<Button isLoading={isLoading}>
  {isLoading ? 'Loading...' : 'Submit'}
</Button>

// Disabled
<Button disabled>
  Disabled
</Button>

// With icon
<Button className="flex items-center gap-2">
  <Icons.Save size={16} />
  Save Changes
</Button>
```

### Styling

- **Primary**: Sky Blue background, white text, hover darkens
- **Secondary**: Gray background, dark text, hover lightens
- **Ghost**: Transparent background, dark text, hover shows background
- **Danger**: Red background, white text, danger indicator

---

## Card

Container component untuk content dengan optional header and footer.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| elevated | boolean | `false` | Show elevated shadow |
| className | string | - | Additional CSS classes |

### Sub-Components

- `Card` - Main container
- `CardHeader` - Header section with border
- `CardBody` - Main content area
- `CardFooter` - Footer section with border

### Examples

```jsx
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/Card';

// Basic card
<Card>
  <CardBody className="p-6">
    Card content
  </CardBody>
</Card>

// Elevated card
<Card elevated>
  <CardHeader>
    Card Title
  </CardHeader>
  <CardBody>
    Main content
  </CardBody>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

// Custom styling
<Card className="bg-primary-50">
  <CardBody>
    Custom styled card
  </CardBody>
</Card>
```

### Styling

- **Default**: White background, subtle shadow, border
- **Elevated**: Larger shadow for prominence
- **Header**: Gray background, border separator
- **Footer**: Gray background, border separator

---

## Input

Form input components dengan validation display.

### Components

#### Input

```jsx
<Input 
  type="text" 
  placeholder="Enter text"
  disabled={false}
/>
```

#### Textarea

```jsx
<Textarea 
  placeholder="Enter message"
  rows={4}
/>
```

#### Label

```jsx
<Label htmlFor="email">Email Address</Label>
```

#### FormGroup

Wrapper component untuk complete form field.

```jsx
<FormGroup
  label="Email"
  error={errors.email?.message}
  helperText="We'll never share your email"
>
  <Input type="email" placeholder="email@example.com" />
</FormGroup>
```

### Props

#### Input / Textarea

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| type | string | `text` | Input type |
| placeholder | string | - | Placeholder text |
| disabled | boolean | `false` | Disable input |
| className | string | - | Additional CSS classes |

#### FormGroup

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| label | string | - | Field label |
| error | string | - | Error message |
| helperText | string | - | Helper text |
| children | ReactNode | - | Form control |

### Examples

```jsx
import { Input, Textarea, Label, FormGroup } from '@/components/ui/Input';

// Basic input
<Input placeholder="Name" />

// Email input
<Input type="email" placeholder="email@example.com" />

// With label and validation
<FormGroup label="Full Name" error={nameError}>
  <Input placeholder="John Doe" value={name} onChange={handleChange} />
</FormGroup>

// Textarea
<FormGroup label="Message" helperText="Max 500 characters">
  <Textarea placeholder="Your message" maxLength={500} />
</FormGroup>

// Disabled state
<Input disabled placeholder="Read-only" />
```

### Styling

- **Base Style**: Rounded border, subtle shadow, focus ring
- **Focus State**: Primary color ring, transparent border
- **Error State**: Red border and text
- **Disabled State**: Gray background, cursor not-allowed

---

## Badge

Small label components for status and statistics.

### Components

#### Badge

Simple badge for labels.

```jsx
<Badge variant="primary">Active</Badge>
```

#### StatCard

Statistics card with icon and trend.

```jsx
<StatCard
  icon={Users}
  label="Total Users"
  value="1,234"
  trend="up"
  trendValue="+12%"
/>
```

#### ProgressBar

Visual progress indicator.

```jsx
<ProgressBar value={75} max={100} variant="primary" label="Progress" showValue />
```

### Props

#### Badge

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | `primary` \| `success` \| `warning` \| `danger` \| `neutral` | `primary` | Badge color |
| className | string | - | Additional CSS classes |

#### StatCard

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| icon | React Component | - | Icon component |
| label | string | - | Stat label |
| value | string \| number | - | Stat value |
| trend | `up` \| `down` | - | Trend direction |
| trendValue | string | - | Trend text |
| loading | boolean | `false` | Show loading state |

#### ProgressBar

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| value | number | 0 | Current progress |
| max | number | 100 | Maximum value |
| variant | `primary` \| `success` \| `warning` \| `danger` | `primary` | Color |
| label | string | - | Progress label |
| showValue | boolean | `false` | Show percentage |

### Examples

```jsx
import { Badge, StatCard, ProgressBar } from '@/components/ui/Badge';
import { Users, TrendingUp } from 'lucide-react';

// Basic badges
<Badge variant="primary">Primary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="danger">Danger</Badge>

// Stat card
<StatCard
  icon={Users}
  label="Active Users"
  value="2,543"
  trend="up"
  trendValue="+5% this week"
/>

// Loading state
<StatCard
  icon={Users}
  label="Users"
  value="..."
  loading={true}
/>

// Progress bar
<ProgressBar 
  value={65}
  max={100}
  variant="success"
  label="Upload Progress"
  showValue
/>
```

### Styling

- **Badge Variants**: 
  - Primary: Blue background and text
  - Success: Green background and text
  - Warning: Amber background and text
  - Danger: Red background and text
  - Neutral: Gray background and text

- **StatCard**: Card with icon, label, large value, and optional trend
- **ProgressBar**: Animated bar with optional label and percentage

---

## Modal

Dialog overlay component for modals and confirmations.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| isOpen | boolean | - | Show modal |
| onClose | function | - | Callback when closing |
| title | string | - | Modal title |
| children | ReactNode | - | Modal content |
| size | `sm` \| `md` \| `lg` \| `xl` \| `2xl` | `md` | Modal width |
| footer | ReactNode | - | Footer content |

### Examples

```jsx
import { Modal } from '@/components/ui/Modal';
import { useState } from 'react';

const [isOpen, setIsOpen] = useState(false);

// Basic modal
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
>
  Are you sure you want to proceed?
</Modal>

// Modal with footer
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Add User"
  size="lg"
  footer={
    <div className="flex gap-3">
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit}>
        Confirm
      </Button>
    </div>
  }
>
  <form onSubmit={handleSubmit} className="space-y-4">
    <FormGroup label="Name">
      <Input placeholder="User name" />
    </FormGroup>
  </form>
</Modal>
```

### Sizing

- `sm` - max-w-sm (384px)
- `md` - max-w-md (448px) - Default
- `lg` - max-w-lg (512px)
- `xl` - max-w-xl (576px)
- `2xl` - max-w-2xl (672px)

### Features

- **Smooth Animations** - Scale & fade animations
- **Backdrop Overlay** - Dark overlay with blur
- **Close Button** - Built-in close button in header
- **Responsive** - Adapts to screen size

---

## Utility Functions

Helper functions untuk common tasks.

### cn() - Class Names

Merge Tailwind classes safely.

```jsx
import { cn } from '@/lib/utils';

<div className={cn(
  'px-4 py-2 rounded-lg',
  isActive && 'bg-primary-600 text-white'
)}>
  Content
</div>
```

### formatBytes()

Format bytes to human readable.

```jsx
import { formatBytes } from '@/lib/utils';

formatBytes(1024) // "1 KB"
formatBytes(1048576) // "1 MB"
formatBytes(1073741824) // "1 GB"
```

### formatDate()

Format date to readable string.

```jsx
import { formatDate } from '@/lib/utils';

formatDate(new Date()) // "27 Apr 2026"
formatDate(new Date(), 'long') // "Sunday, April 27, 2026"
formatDate(new Date(), 'time') // "14:30"
```

### formatDuration()

Format seconds to readable duration.

```jsx
import { formatDuration } from '@/lib/utils';

formatDuration(45) // "45s"
formatDuration(150) // "2m"
formatDuration(3661) // "1h"
```

### debounce()

Debounce function calls.

```jsx
import { debounce } from '@/lib/utils';

const handleSearch = debounce((query) => {
  // Search API call
}, 300);

<input onChange={(e) => handleSearch(e.target.value)} />
```

### throttle()

Throttle function calls.

```jsx
import { throttle } from '@/lib/utils';

const handleScroll = throttle(() => {
  // Handle scroll
}, 200);

window.addEventListener('scroll', handleScroll);
```

---

## Best Practices

1. **Use Design System Colors** - Always use colors from the palette
2. **Combine Components** - Build complex UIs from simple components
3. **Add Validation** - Use validation schemas for forms
4. **Make Responsive** - Test on mobile and desktop
5. **Use Icons** - Lucide React icons for consistency
6. **Add Animations** - Use Framer Motion for smooth transitions
7. **Document Changes** - Update docs when modifying components

---

## Contributing

When adding new components:

1. Create file in `src/components/ui/`
2. Export from component index
3. Add to this documentation
4. Test on multiple screen sizes
5. Ensure TypeScript compatibility (if applicable)

---

**Last Updated:** April 27, 2026
