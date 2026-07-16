import { createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router';
import { OnboardingPage } from './pages/consumer/OnboardingPage';
import { FeedPage } from './pages/consumer/FeedPage';
import { LoginPage } from './pages/consumer/LoginPage';
import { WalletPage } from './pages/consumer/WalletPage';
import { TransactionsPage } from './pages/consumer/TransactionsPage';
import { InsightsPage } from './pages/consumer/InsightsPage';
import { PoolSettingsPage } from './pages/consumer/PoolSettingsPage';
import { AchievementsPage } from './pages/consumer/AchievementsPage';
import { ImpactPage } from './pages/ImpactPage';
import { AdvertiserDashboardPage } from './pages/advertiser/AdvertiserDashboardPage';
import { CampaignCreatePage } from './pages/advertiser/CampaignCreatePage';
import { CampaignStatsPage } from './pages/advertiser/CampaignStatsPage';
import { AnalyticsDashboardPage } from './pages/advertiser/AnalyticsDashboardPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: OnboardingPage,
});

const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feed',
  component: FeedPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.replace('/login');
      return null;
    }
    window.location.replace('/feed');
    return null;
  },
});

const walletRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wallet',
  component: WalletPage,
});

const transactionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/transactions',
  component: TransactionsPage,
});

const insightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/insights',
  component: InsightsPage,
});

const poolSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pool-settings',
  component: PoolSettingsPage,
});

const rewardsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rewards',
  component: AchievementsPage,
});

const impactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/impact',
  component: ImpactPage,
});

const advertiserRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/advertiser',
  component: AdvertiserDashboardPage,
});

const campaignCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/advertiser/campaigns/new',
  component: CampaignCreatePage,
});

const campaignStatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/advertiser/campaigns/$campaignId/stats',
  component: CampaignStatsPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/advertiser/analytics',
  component: AnalyticsDashboardPage,
});

const ADMIN_TABS = ['financials', 'fraud', 'users', 'advertisers', 'campaigns'] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  validateSearch: (search: Record<string, unknown>): { tab: AdminTab } => {
    const tab = search.tab;
    return {
      tab: ADMIN_TABS.includes(tab as AdminTab) ? (tab as AdminTab) : 'financials',
    };
  },
  component: AdminDashboardPage,
});

const auditLogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/audit-log',
  component: AuditLogPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute, loginRoute, onboardingRoute, feedRoute, walletRoute, transactionsRoute,
  insightsRoute, poolSettingsRoute, rewardsRoute, impactRoute,
  advertiserRoute, campaignCreateRoute, campaignStatsRoute, analyticsRoute,
  adminRoute, auditLogRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
