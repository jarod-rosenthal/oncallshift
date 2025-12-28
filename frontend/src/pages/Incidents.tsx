import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { incidentsAPI } from '../lib/api-client';
import type { Incident } from '../types/api';

export function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      setIsLoading(true);
      const response = await incidentsAPI.list();
      setIncidents(response.incidents);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load incidents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await incidentsAPI.acknowledge(id);
      await loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to acknowledge incident');
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await incidentsAPI.resolve(id);
      await loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resolve incident');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'error':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'triggered':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Incidents</h2>
          <p className="text-muted-foreground">
            Manage and respond to active incidents
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading incidents...</p>
          </div>
        ) : incidents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No incidents found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <Card key={incident.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                          {incident.severity.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStateColor(incident.state)}`}>
                          {incident.state.toUpperCase()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          #{incident.incidentNumber}
                        </span>
                      </div>
                      <CardTitle>{incident.summary}</CardTitle>
                      <CardDescription>
                        Service: {incident.service.name} | Triggered: {new Date(incident.triggeredAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {incident.state === 'triggered' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(incident.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {incident.state !== 'resolved' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleResolve(incident.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {incident.details && (
                  <CardContent>
                    <pre className="text-sm bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(incident.details, null, 2)}
                    </pre>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
