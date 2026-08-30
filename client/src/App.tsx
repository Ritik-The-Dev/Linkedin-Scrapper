import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/layout/Layout.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { LeadDetailPage } from './pages/LeadDetailPage.tsx';
import { LeadsPage } from './pages/LeadsPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

/**
 * Route table.
 *
 *   /                    landing
 *   /dashboard           search, stats and Excel import
 *   /leads               stored leads, searchable and paginated
 *   /leads/:username     full profile
 */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:username" element={<LeadDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
