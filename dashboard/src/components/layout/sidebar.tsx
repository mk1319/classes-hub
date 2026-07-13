import { Link, useRouterState } from '@tanstack/react-router';
import { Separator } from '@/components/ui/separator';
import { getSession } from '@/lib/auth';
import { visibleNavGroups } from '@/lib/nav-config';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const session = getSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = visibleNavGroups(session?.role === 'admin' ? 'admin' : 'teacher');

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center px-4">
        <span className="text-lg font-semibold text-foreground">Classes Hub</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-2">
        {groups.map((group, index) => (
          <div key={group.label ?? 'root'}>
            {index > 0 && <Separator className="mb-4" />}
            {group.label && (
              <div className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <group.icon className="h-3.5 w-3.5" />
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-accent-foreground',
                    pathname === item.to && 'bg-accent text-accent-foreground'
                  )}
                >
                  {!group.label && <group.icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
