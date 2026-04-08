/**
 * Aurora Deep Design Tokens
 * Dark glassmorphism theme for IBR web-ui
 */

// ── Background ──────────────────────────────────────────────
export const bg = {
  base: '#060611',
  ambient: [
    'radial-gradient(ellipse at 15% 30%, rgba(99,102,241,0.07) 0%, transparent 50%)',
    'radial-gradient(ellipse at 75% 15%, rgba(34,211,238,0.05) 0%, transparent 45%)',
    'radial-gradient(ellipse at 50% 85%, rgba(167,139,250,0.04) 0%, transparent 50%)',
  ],
} as const;

// ── Surfaces ────────────────────────────────────────────────
export const surface = {
  glass: 'rgba(255,255,255,0.025)',
  glassHover: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.06)',
  input: 'rgba(255,255,255,0.03)',
  activeItem: 'rgba(129,140,248,0.12)',
  hoverItem: 'rgba(255,255,255,0.025)',
} as const;

// ── Text ────────────────────────────────────────────────────
export const text = {
  primary: '#f0f0f5',
  secondary: '#9d9db5',
  muted: '#5a5a72',
  inverse: '#060611',
} as const;

// ── Status (text-only, no background badges) ────────────────
export const status = {
  match: '#34d399',     // emerald
  changed: '#fbbf24',   // amber
  broken: '#fb7185',    // rose
  active: '#818cf8',    // indigo
  pending: '#5a5a72',   // muted
} as const;

// ── Accent ──────────────────────────────────────────────────
export const accent = {
  indigo: '#818cf8',
  indigoDark: '#6366f1',
  gradient: 'linear-gradient(135deg, #818cf8, #6366f1)',
  glow: '0 4px 20px rgba(99,102,241,0.4)',
  focusRing: '0 0 0 3px rgba(129,140,248,0.12)',
} as const;

// ── Sidebar ─────────────────────────────────────────────────
export const sidebar = {
  width: 56,
  activeBg: 'rgba(129,140,248,0.12)',
  activeText: '#f0f0f5',
  inactiveText: '#5a5a72',
  hoverText: '#9d9db5',
  hoverBg: 'rgba(255,255,255,0.025)',
  dotSize: 6,
} as const;

// ── Glass ───────────────────────────────────────────────────
export const glass = {
  background: 'rgba(255,255,255,0.025)',
  blur: 'blur(12px)',
  blurHeavy: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '12px',
} as const;

// ── Spacing (8pt grid) ──────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

// ── Typography ──────────────────────────────────────────────
export const type = {
  title: { size: '15px', weight: 500 },
  body: { size: '13px', weight: 400 },
  meta: { size: '11px', weight: 400 },
  score: { size: '48px', weight: 700 },
  modalTitle: { size: '18px', weight: 600 },
} as const;

// ── Motion ──────────────────────────────────────────────────
export const motion = {
  interactive: '0.2s ease',
  card: '0.25s ease',
  reduced: '0.01ms',
} as const;

// ── Layout ──────────────────────────────────────────────────
export const layout = {
  libraryWidth: 220,
  detailsWidth: 240,
  devicesWidth: 240,
  sidebarWidth: 56,
  touchTarget: 44,
  iconButton: 36,
} as const;
