import type { LucideIcon } from 'lucide-react';
import { Home, GraduationCap, ClipboardList, FolderOpen, Megaphone, Users } from 'lucide-react';

export type DashboardRole = 'admin' | 'teacher';

export interface NavItem {
  label: string;
  to: string;
  roles: DashboardRole[];
}

export interface NavGroup {
  label: string | null;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    icon: Home,
    items: [{ label: 'Dashboard', to: '/', roles: ['admin', 'teacher'] }],
  },
  {
    label: 'Academics',
    icon: GraduationCap,
    items: [
      { label: 'Courses', to: '/courses', roles: ['admin', 'teacher'] },
      { label: 'Timetable', to: '/timetable', roles: ['admin', 'teacher'] },
      { label: 'Syllabus', to: '/syllabus', roles: ['admin', 'teacher'] },
    ],
  },
  {
    label: 'Tests',
    icon: ClipboardList,
    items: [
      { label: 'Question Bank', to: '/questions', roles: ['admin', 'teacher'] },
      { label: 'Tests', to: '/tests', roles: ['admin', 'teacher'] },
    ],
  },
  {
    label: 'Content',
    icon: FolderOpen,
    items: [{ label: 'Resources', to: '/resources', roles: ['admin', 'teacher'] }],
  },
  {
    label: 'Communication',
    icon: Megaphone,
    items: [{ label: 'Announcements', to: '/announcements', roles: ['admin', 'teacher'] }],
  },
  {
    label: 'Management',
    icon: Users,
    items: [{ label: 'Staff & Students', to: '/staff', roles: ['admin'] }],
  },
];

export function findNavItemByPath(pathname: string): NavItem | undefined {
  for (const group of NAV_GROUPS) {
    const match = group.items.find((item) => item.to === pathname);
    if (match) return match;
  }
  return undefined;
}

export function visibleNavGroups(role: DashboardRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
