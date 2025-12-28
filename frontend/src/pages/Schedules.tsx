import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { schedulesAPI } from '../lib/api-client';
import type { Schedule } from '../types/api';

export function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setIsLoading(true);
      const response = await schedulesAPI.list();
      setSchedules(response.schedules);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load schedules');
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'manual':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'daily':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'weekly':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost">&larr; Back to Dashboard</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-2">On-Call Schedules</h2>
            <p className="text-muted-foreground">
              Manage your team's on-call rotation schedules
            </p>
          </div>
          <Button>Create Schedule</Button>
        </div>

        {error && (
          <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading schedules...</p>
          </div>
        ) : schedules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No schedules found</p>
              <Button>Create Your First Schedule</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {schedules.map((schedule) => (
              <Card key={schedule.id}>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(schedule.type)}`}>
                      {schedule.type.toUpperCase()}
                    </span>
                    {schedule.isOverride && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                        OVERRIDE
                      </span>
                    )}
                  </div>
                  <CardTitle>{schedule.name}</CardTitle>
                  {schedule.description && (
                    <CardDescription>{schedule.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Timezone:</span>{' '}
                      <span className="font-medium">{schedule.timezone}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current On-Call:</span>{' '}
                      <span className="font-medium">
                        {schedule.currentOncallUserId || 'None'}
                      </span>
                    </div>
                    {schedule.isOverride && schedule.overrideUntil && (
                      <div>
                        <span className="text-muted-foreground">Override Until:</span>{' '}
                        <span className="font-medium">
                          {new Date(schedule.overrideUntil).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <Button variant="outline" className="w-full" size="sm">
                      Manage Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
