# 🚀 Quick Start - Frontend Redesign

## 1️⃣ Install Dependencies

```bash
cd frontend
npm install
```

## 2️⃣ Run Development Server

```bash
npm run dev
```

Server akan berjalan di `http://localhost:5173` (atau port yang tersedia)

## 3️⃣ Build for Production

```bash
npm run build
```

## 📚 Using Design System Components

### Button Component

```jsx
import { Button } from './components/ui/Button';

// Variants: primary (default), secondary, ghost, danger
// Sizes: sm, md (default), lg

<Button onClick={handleClick}>Click me</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="danger" size="lg">Delete</Button>
<Button isLoading={loading}>Loading...</Button>
```

### Card Component

```jsx
import { Card, CardBody, CardHeader, CardFooter } from './components/ui/Card';

<Card elevated>
  <CardHeader>Header Title</CardHeader>
  <CardBody>Card content goes here</CardBody>
  <CardFooter>Footer action</CardFooter>
</Card>
```

### Input Component

```jsx
import { Input, Label, Textarea, FormGroup } from './components/ui/Input';

<FormGroup label="Email" error={errors.email?.message}>
  <Input type="email" placeholder="your@email.com" />
</FormGroup>

<Textarea placeholder="Message..." rows={4} />
```

### Badge & Stat Components

```jsx
import { Badge, StatCard, ProgressBar } from './components/ui/Badge';
import { Users, TrendingUp } from 'lucide-react';

<Badge variant="success">Active</Badge>

<StatCard 
  icon={Users} 
  label="Total Users"
  value="1,234"
  trend="up"
  trendValue="+12%"
/>

<ProgressBar value={75} max={100} variant="primary" label="Progress" showValue />
```

### Modal Component

```jsx
import { Modal } from './components/ui/Modal';
import { useState } from 'react';

const [isOpen, setIsOpen] = useState(false);

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  size="md"
  footer={
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </div>
  }
>
  Modal content here
</Modal>
```

### Form Validation with React Hook Form

```jsx
import { useForm, Controller } from 'react-hook-form';
import { contactFormSchema } from '../lib/validationSchemas';
import { Input, FormGroup } from './ui/Input';
import { Button } from './ui/Button';
import { zodResolver } from '@hookform/resolvers/zod';

export function MyForm() {
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(contactFormSchema),
  });

  const onSubmit = async (data) => {
    // Handle form submission
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormGroup label="Name" error={errors.name?.message}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => <Input {...field} placeholder="Full name" />}
        />
      </FormGroup>

      <Button isLoading={isSubmitting} type="submit">
        Submit
      </Button>
    </form>
  );
}
```

## 🎨 Color Usage

### Using Colors from Design System

```jsx
// Using Tailwind color classes
<div className="bg-primary-100 text-primary-700 border-primary-200">
  Primary color
</div>

<div className="bg-success-100 text-success-700">Success</div>
<div className="bg-danger-100 text-danger-700">Danger</div>
<div className="bg-warning-100 text-warning-700">Warning</div>
<div className="bg-accent-100 text-accent-700">Accent</div>
```

## 🎯 Utility Functions

```jsx
import { cn, formatBytes, formatDate, formatDuration, debounce } from '../lib/utils';

// Merge classes safely
<div className={cn('px-4 py-2', isActive && 'bg-primary-600')}>
  Conditional classes
</div>

// Format utilities
formatBytes(1024) // "1 KB"
formatDate(new Date()) // "27 Apr 2026"
formatDuration(45) // "45s"

// Debounce
const handleSearch = debounce((query) => {
  // Search logic
}, 300);
```

## 📊 ApexCharts Usage

```jsx
import Chart from 'react-apexcharts';

const chartOptions = {
  chart: { type: 'area', fontFamily: 'Inter', toolbar: { show: false } },
  colors: ['#0ea5e9', '#ef4444'],
  stroke: { curve: 'smooth', width: 2 },
};

const chartSeries = [
  { name: 'Delivered', data: [100, 200, 150] },
  { name: 'Failed', data: [20, 30, 25] }
];

<Chart options={chartOptions} series={chartSeries} type="area" height={300} />
```

## 🎬 Animations

```jsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Animated content
</motion.div>

// Stagger animation for lists
<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.div key={item.id} variants={itemVariants}>
      {item.name}
    </motion.div>
  ))}
</motion.div>
```

## 📱 Responsive Design

```jsx
// Using Tailwind responsive classes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
  {/* Automatically responsive */}
</div>

// Mobile first approach
<div className="p-4 md:p-6 lg:p-8">
  Responsive padding
</div>
```

## 🔍 Troubleshooting

### Build Error: "Cannot find module"
```bash
npm install
npm run build
```

### Development server won't start
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Styling not applied
- Make sure Tailwind CSS is properly configured
- Check `tailwind.config.js`
- Rebuild if needed: `npm run build`

## 📚 References

- **Tailwind CSS** - https://tailwindcss.com
- **Framer Motion** - https://www.framer.com/motion/
- **React Hook Form** - https://react-hook-form.com/
- **Zod** - https://zod.dev/
- **ApexCharts** - https://apexcharts.com/
- **Lucide Icons** - https://lucide.dev/

## ✅ Checklist for Adding New Features

- [ ] Create/use component from design system
- [ ] Add validation schema if needed (in `lib/validationSchemas.js`)
- [ ] Use color classes from design system
- [ ] Make responsive (mobile-first)
- [ ] Add animations with Framer Motion
- [ ] Test on mobile and desktop
- [ ] Update documentation

---

**Happy coding! 🎉**
