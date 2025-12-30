# UI Components

Base UI components following Calm Precision design guidelines.

## Components

### Button

Button component with multiple variants and sizes following Fitts' Law.

```tsx
import { Button } from '@/components/ui';

// Primary action (conversion)
<Button variant="primary">Save Changes</Button>

// Secondary action
<Button variant="secondary">Cancel</Button>

// Ghost/minimal action
<Button variant="ghost">Learn More</Button>

// Danger action
<Button variant="danger">Delete</Button>

// With icon
<Button variant="primary" icon={<PlusIcon />}>
  Add Item
</Button>

// Icon only
<Button variant="ghost" icon={<SettingsIcon />} aria-label="Settings" />

// Loading state
<Button variant="primary" loading>Saving...</Button>

// Sizes (all maintain >=44px touch target)
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
```

**Design Principles:**
- Touch targets ≥44px on mobile (min-width enforced)
- Size matches user intent weight (Fitts' Law)
- Clear visual hierarchy through color and weight
- 8pt grid spacing

### Modal

Accessible modal dialog with overlay, keyboard navigation, and click-outside-to-close.

```tsx
import { Modal, Button } from '@/components/ui';

const [isOpen, setIsOpen] = useState(false);

<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="New Session"
  footer={
    <>
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSubmit}>
        Create
      </Button>
    </>
  }
>
  <p>Modal content goes here...</p>
</Modal>
```

**Features:**
- Escape key to close
- Click overlay to close
- Prevents body scroll when open
- Accessible with proper ARIA attributes
- Single border around group (Calm Precision)

### Badge

Status badge using text color only (no background boxes per Calm Precision).

```tsx
import { Badge } from '@/components/ui';

<Badge variant="match">Match</Badge>
<Badge variant="changed">8.2% Changed</Badge>
<Badge variant="broken">52% Broken</Badge>
<Badge variant="pending">Not Compared</Badge>
<Badge variant="expected">Expected Change</Badge>
```

**Design Principles:**
- Text color only for status (Signal-to-Noise)
- WCAG AA contrast ratios (4.5:1 minimum)
- Clear semantic meaning through color

**Color Mapping:**
- `match` - Green (success)
- `changed` - Amber (warning/attention)
- `broken` - Red (error)
- `pending` - Gray (neutral/inactive)
- `expected` - Blue (info)

### Skeleton

Loading state indicators with shimmer animation.

```tsx
import { Skeleton, SkeletonListItem, SkeletonCard } from '@/components/ui';

// Basic skeleton
<Skeleton variant="text" />
<Skeleton variant="thumbnail" />
<Skeleton variant="block" height={100} />

// Custom dimensions
<Skeleton variant="block" width="80%" height={200} />

// Pre-built patterns
<SkeletonListItem />
<SkeletonCard lines={5} />
```

**Design Principles:**
- 1.5s shimmer cycle (per design spec)
- Matches final layout structure
- Subtle visual indication of loading
- Accessible with proper ARIA labels

## Design Guidelines

All components follow Calm Precision principles:

1. **Group, Don't Isolate** - Single border around related items
2. **Size = Importance** - Button size matches user intent weight
3. **Three-Line Hierarchy** - Title → Description → Metadata
4. **Text Over Decoration** - Color and weight create hierarchy
5. **Touch Targets** - ≥44px on mobile, ≥24px desktop
6. **8pt Grid** - Consistent spacing and vertical rhythm
7. **Accessibility** - WCAG 2.2 AA compliance

## File Structure

```
components/ui/
├── Button.tsx          # Primary action component
├── Modal.tsx           # Dialog/overlay component
├── Badge.tsx           # Status indicator
├── Skeleton.tsx        # Loading states
├── index.ts            # Exports
└── README.md           # This file
```

## Customization

Components use Tailwind CSS classes and can be customized via:
- `className` prop for additional styles
- Tailwind config for global theme changes
- CSS variables for color overrides

## Accessibility

All components include:
- Proper ARIA attributes
- Keyboard navigation support
- Focus indicators
- Screen reader labels
- Touch target compliance
