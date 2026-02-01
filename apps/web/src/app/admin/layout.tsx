import { AdminLayout } from '@/components/admin';

export const metadata = {
  title: 'Admin - Trading Fight Club',
  description: 'Admin panel for Trading Fight Club',
};

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
