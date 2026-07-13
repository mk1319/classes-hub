import { createFileRoute } from '@tanstack/react-router';
import { ComingSoonPage } from '@/components/coming-soon-page';

export const Route = createFileRoute('/_authed/questions')({
  component: () => <ComingSoonPage title="Question Bank" />,
});
