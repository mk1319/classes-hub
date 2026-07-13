import { useNavigate, useRouterState } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useLogout } from '@/features/auth/api';
import { getSession } from '@/lib/auth';
import { findNavItemByPath } from '@/lib/nav-config';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function Header() {
  const navigate = useNavigate();
  const logout = useLogout();
  const session = getSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = findNavItemByPath(pathname)?.label ?? 'Dashboard';

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) });
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{session ? initials(session.name) : '?'}</AvatarFallback>
          </Avatar>
          <span className="text-foreground">
            {session?.name} <span className="text-muted-foreground">({session?.role})</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleLogout}>Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
