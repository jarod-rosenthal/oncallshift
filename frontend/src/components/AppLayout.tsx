import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { incidentsAPI } from '../lib/api-client';
import { ThemeProvider } from '../contexts/ThemeContext';
import { onIncidentChanged } from '../lib/incident-events';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openIncidentCount, setOpenIncidentCount] = useState(0);

  // Theme initialization is now handled by ThemeProvider and the inline script in index.html

  const fetchIncidentCount = useCallback(async () => {
    try {
      const response = await incidentsAPI.list();
      // Handle paginated response
      const incidents = response.incidents || (response as any).data || [];
      const openIncidents = incidents.filter(
        (inc: any) => inc.state === 'triggered' || inc.state === 'acknowledged'
      );
      setOpenIncidentCount(openIncidents.length);
    } catch (error) {
      console.error('Failed to fetch incident count:', error);
    }
  }, []);

  useEffect(() => {
    fetchIncidentCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchIncidentCount, 30000);
    // Also listen for immediate updates when incidents change
    const unsubscribe = onIncidentChanged(fetchIncidentCount);
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [fetchIncidentCount]);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
          incidentCount={openIncidentCount}
        />
        <Header sidebarCollapsed={sidebarCollapsed} />
        <main
          className={`pt-16 transition-all duration-300 ${
            sidebarCollapsed ? 'ml-16' : 'ml-64'
          }`}
        >
          <div className="p-6">{children}</div>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default AppLayout;
