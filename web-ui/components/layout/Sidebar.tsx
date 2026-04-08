'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Sessions',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M3 9h18" />
      </svg>
    ),
  },
  {
    href: '/design-system',
    label: 'Design System',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    href: '/workflows',
    label: 'Workflows',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    href: '/native',
    label: 'Native Testing',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M12 18h.01" />
      </svg>
    ),
  },
];

const settingsItem: NavItem = {
  href: '/settings',
  label: 'Settings',
  icon: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`
        relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200
        ${isActive
          ? 'bg-[rgba(129,140,248,0.12)] text-[#f0f0f5]'
          : 'text-[#5a5a72] hover:text-[#9d9db5] hover:bg-[rgba(255,255,255,0.025)]'
        }
      `}
      aria-label={item.label}
      title={item.label}
    >
      {item.icon}
      {/* Active indicator dot */}
      {isActive && (
        <span
          className="absolute -right-[3px] top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full bg-[#818cf8]"
          style={{ boxShadow: '0 0 8px rgba(129,140,248,0.6)' }}
        />
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col items-center py-4 border-r border-[rgba(255,255,255,0.06)] bg-[#060611]/80 backdrop-blur-xl"
      style={{ width: 56 }}
    >
      {/* Logo mark */}
      <Link
        href="/dashboard"
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#818cf8] to-[#6366f1] mb-6"
        aria-label="IBR Home"
      >
        <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 12h18" />
        </svg>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={pathname === item.href || (item.href === '/dashboard' && pathname === '/')}
          />
        ))}
      </nav>

      {/* Settings (pinned bottom) */}
      <NavLink
        item={settingsItem}
        isActive={pathname === '/settings'}
      />
    </aside>
  );
}
