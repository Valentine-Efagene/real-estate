'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdminOnly, StaffOnly } from '@/components/auth';
import { PersonaSwitcher } from '@/components/demo/persona-switcher';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Properties', href: '/properties' },
  { name: 'My Applications', href: '/applications' },
];

const adminNavigation = [
  { name: 'All Applications', href: '/admin/applications' },
  { name: 'Properties', href: '/admin/properties' },
  { name: 'Users', href: '/admin/users' },
  { name: 'Organizations', href: '/admin/organizations' },
  { name: 'Questionnaire Plans', href: '/admin/questionnaire-plans' },
  { name: 'Documentation Plans', href: '/admin/documentation-plans' },
  { name: 'Payment Plans', href: '/admin/payment-plans' },
  { name: 'Payment Methods', href: '/admin/payment-methods' },
  { name: 'Bank Doc Requirements', href: '/admin/bank-document-requirements' },
  { name: 'Authorization', href: '/admin/authorization' },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          {/* Logo and main nav */}
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link href="/" className="text-xl font-bold text-primary">
                QShelter
              </Link>
            </div>
            {isAuthenticated && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium',
                      pathname === item.href
                        ? 'border-primary text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
                <StaffOnly>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium',
                          pathname.startsWith('/admin')
                            ? 'border-primary text-gray-900'
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        )}
                      >
                        Admin ▾
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {adminNavigation.map((item) => (
                        <DropdownMenuItem key={item.name} asChild>
                          <Link href={item.href}>{item.name}</Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </StaffOnly>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Demo persona switcher */}
            <PersonaSwitcher />

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getInitials(user?.email || 'U')}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.email}</p>
                      <p className="text-xs text-gray-500">
                        {user?.roles.join(', ')}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <AdminOnly>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/settings">Settings</Link>
                    </DropdownMenuItem>
                  </AdminOnly>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-4">
                <Link href="/login">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link href="/register">
                  <Button>Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
