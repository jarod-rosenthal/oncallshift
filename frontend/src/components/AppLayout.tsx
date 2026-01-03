import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { incidentsAPI } from '../lib/api-client';
import { ThemeProvider } from '../contexts/ThemeContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openIncidentCount, setOpenIncidentCount] = useState(0);

  // Theme initialization is now handled by ThemeProvider and the inline script in index.html

  useEffect(() => {
    const fetchIncidentCount = async () => {
      try {
        const response = await incidentsAPI.list();
        const openIncidents = response.incidents.filter(
          (inc) => inc.state === 'triggered' || inc.state === 'acknowledged'
        );
        setOpenIncidentCount(openIncidents.length);
      } catch (error) {
        console.error('Failed to fetch incident count:', error);
      }
    };

    fetchIncidentCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchIncidentCount, 30000);
    return () => clearInterval(interval);
  }, []);

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
