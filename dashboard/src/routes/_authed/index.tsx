import { createFileRoute, Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { currentClaims, isStaff, isSuperAdmin } from '@/lib/auth';

export const Route = createFileRoute('/_authed/')({ component: Overview });

const cards = [
  { to: '/students', title: 'People', desc: 'Teachers & students, bulk import, device history' },
  { to: '/courses', title: 'Courses', desc: 'Courses → subjects → batches, teachers, enrollment' },
  { to: '/tests', title: 'Tests', desc: 'Question bank, test builder, grading & results' },
  { to: '/timetable', title: 'Timetable', desc: 'Per-batch schedule with weekly recurrence' },
  { to: '/resources', title: 'Resources', desc: 'Study materials — uploads or external links' },
  { to: '/syllabus', title: 'Syllabus', desc: 'Chapter lists & coverage logs per batch' },
  { to: '/notifications', title: 'Announcements', desc: 'Send push + in-app announcements' },
];

function Overview() {
  const claims = currentClaims();
  const role = claims?.role;

  return (
    <div>
      <PageHeader title="Overview" description="Everything you manage, in one place." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isSuperAdmin(role) && (
          <LinkCard to="/tenants" title="Tenants" desc="Onboard tutors and configure their branding" />
        )}
        {isStaff(role) && cards.map((c) => <LinkCard key={c.to} {...c} />)}
      </div>
    </div>
  );
}

function LinkCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </Link>
  );
}
