import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export function Analytics() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">Analytics</h2>
        <p className="text-muted-foreground">
          Incident metrics and team performance insights
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Incidents</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>MTTA (Mean Time to Acknowledge)</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>MTTR (Mean Time to Resolve)</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Incidents This Week</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analytics Dashboard</CardTitle>
          <CardDescription>
            Detailed analytics and reporting features are coming soon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Coming Soon</h3>
            <p className="text-gray-500 max-w-md">
              We're building comprehensive analytics to help you understand incident patterns,
              team performance, and service reliability metrics.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Incident trends</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">Response times</span>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">Service health</span>
              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">Team metrics</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Analytics;
