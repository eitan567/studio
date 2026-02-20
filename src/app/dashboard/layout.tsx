import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <SiteHeader />
      <main className="flex-1 overflow-hidden">{children}</main>
      <SiteFooter className="[&>div]:py-3 [&>div]:md:h-auto border-t border-border/50" />
    </div>
  );
}
