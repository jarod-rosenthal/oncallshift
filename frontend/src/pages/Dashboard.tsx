import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useAuthStore } from '../store/auth-store';
import { authAPI } from '../lib/api-client';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleLogout = () => {
    authAPI.logout();
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">PagerDuty Lite</h1>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Manage your incidents and on-call schedules
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link to="/incidents">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle>Incidents</CardTitle>
                <CardDescription>
                  View and manage active incidents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">View Incidents</Button>
              </CardContent>
            </Card>
          </Link>

          <Link to="/schedules">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle>Schedules</CardTitle>
                <CardDescription>
                  Manage on-call schedules and rotations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">View Schedules</Button>
              </CardContent>
            </Card>
          </Link>

          <Card className="opacity-50">
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                Coming soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                View Services
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
