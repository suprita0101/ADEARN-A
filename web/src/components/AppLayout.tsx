import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Topbar } from './Topbar';

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function AppLayout({ title, subtitle, actions, children }: AppLayoutProps) {
  return (
    <div
      className="flex overflow-hidden"
      style={{ height: '100dvh', backgroundColor: '#060b14' }}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} subtitle={subtitle} actions={actions} />
        {/* Extra bottom padding on mobile so content clears the bottom tab bar */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6 page-content">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
