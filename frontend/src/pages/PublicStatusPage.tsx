import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, AlertTriangle, XCircle, Clock, Mail } from 'lucide-react';

interface ServiceStatus {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
  activeIncidents: {
    id: string;
    summary: string;
    severity: string;
    state: string;
    triggeredAt: string;
  }[];
}

interface StatusUpdate {
  id: string;
  title: string;
  message: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'none' | 'minor' | 'major' | 'critical';
  createdAt: string;
  isScheduled: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

interface PublicStatusPageData {
  name: string;
  description: string | null;
  primaryColor: string;
  overallStatus: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
  services: ServiceStatus[];
  updates: StatusUpdate[];
  allowSubscriptions: boolean;
}

const STATUS_CONFIG = {
  operational: { label: 'Operational', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  degraded: { label: 'Degraded Performance', icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  partial_outage: { label: 'Partial Outage', icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-100' },
  major_outage: { label: 'Major Outage', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
};

const UPDATE_STATUS_CONFIG = {
  investigating: { label: 'Investigating', color: 'text-red-600', bg: 'bg-red-100' },
  identified: { label: 'Identified', color: 'text-orange-600', bg: 'bg-orange-100' },
  monitoring: { label: 'Monitoring', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  resolved: { label: 'Resolved', color: 'text-green-600', bg: 'bg-green-100' },
};

export function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicStatusPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  useEffect(() => {
    loadStatusPage();
  }, [slug]);

  const loadStatusPage = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      // Use fetch directly since this is a public endpoint (no auth)
      const response = await fetch(`/api/v1/status-pages/public/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Status page not found');
        } else {
          setError('Failed to load status page');
        }
        return;
      }
      const pageData = await response.json();
      setData(pageData);
      setError(null);
    } catch (err) {
      console.error('Failed to load status page:', err);
      setError('Failed to load status page');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !slug) return;

    try {
      setSubscribing(true);
      const response = await fetch(`/api/v1/status-pages/public/${slug}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSubscribeSuccess(true);
        setEmail('');
        setTimeout(() => {
          setShowSubscribe(false);
          setSubscribeSuccess(false);
        }, 3000);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to subscribe');
      }
    } catch (err) {
      console.error('Failed to subscribe:', err);
      alert('Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Status Page Not Found</h1>
          <p className="text-gray-600">{error || 'The requested status page does not exist.'}</p>
        </div>
      </div>
    );
  }

  const OverallStatusIcon = STATUS_CONFIG[data.overallStatus].icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header
        className="text-white py-8"
        style={{ backgroundColor: data.primaryColor }}
      >
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold">{data.name}</h1>
          {data.description && (
            <p className="mt-2 text-white/80">{data.description}</p>
          )}
        </div>
      </header>

      {/* Overall Status */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        <div className={`rounded-lg shadow-lg p-6 ${STATUS_CONFIG[data.overallStatus].bg}`}>
          <div className="flex items-center gap-3">
            <OverallStatusIcon className={`w-8 h-8 ${STATUS_CONFIG[data.overallStatus].color}`} />
            <div>
              <h2 className={`text-xl font-bold ${STATUS_CONFIG[data.overallStatus].color}`}>
                {STATUS_CONFIG[data.overallStatus].label}
              </h2>
              <p className="text-sm text-gray-600">
                Last updated: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Services */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Services</h2>
          <div className="bg-white rounded-lg shadow divide-y">
            {data.services.map((service) => {
              const StatusIcon = STATUS_CONFIG[service.status].icon;
              return (
                <div key={service.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{service.name}</span>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`w-5 h-5 ${STATUS_CONFIG[service.status].color}`} />
                      <span className={`text-sm ${STATUS_CONFIG[service.status].color}`}>
                        {STATUS_CONFIG[service.status].label}
                      </span>
                    </div>
                  </div>
                  {service.activeIncidents.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {service.activeIncidents.map((incident) => (
                        <div
                          key={incident.id}
                          className="text-sm bg-gray-50 rounded p-2 flex items-start gap-2"
                        >
                          <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-gray-800">{incident.summary}</p>
                            <p className="text-xs text-gray-500">
                              {incident.state} - {new Date(incident.triggeredAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {data.services.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No services configured
              </div>
            )}
          </div>
        </section>

        {/* Recent Updates */}
        {data.updates.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Updates</h2>
            <div className="space-y-4">
              {data.updates.map((update) => (
                <div key={update.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {update.isScheduled && (
                        <Clock className="w-4 h-4 text-blue-500" />
                      )}
                      <h3 className="font-medium text-gray-900">{update.title}</h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        UPDATE_STATUS_CONFIG[update.status].bg
                      } ${UPDATE_STATUS_CONFIG[update.status].color}`}
                    >
                      {UPDATE_STATUS_CONFIG[update.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{update.message}</p>
                  <p className="text-xs text-gray-400">
                    {update.isScheduled && update.scheduledStart
                      ? `Scheduled: ${new Date(update.scheduledStart).toLocaleString()}`
                      : new Date(update.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Subscribe Section */}
        {data.allowSubscriptions && (
          <section className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-6 h-6 text-gray-400" />
                <div>
                  <h3 className="font-medium text-gray-900">Subscribe to Updates</h3>
                  <p className="text-sm text-gray-500">
                    Get notified when there are status changes
                  </p>
                </div>
              </div>
              {!showSubscribe && (
                <button
                  onClick={() => setShowSubscribe(true)}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Subscribe
                </button>
              )}
            </div>

            {showSubscribe && (
              <form onSubmit={handleSubscribe} className="mt-4 flex gap-2">
                {subscribeSuccess ? (
                  <div className="flex-1 text-green-600 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Successfully subscribed!
                  </div>
                ) : (
                  <>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                      required
                    />
                    <button
                      type="submit"
                      disabled={subscribing}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {subscribing ? 'Subscribing...' : 'Subscribe'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSubscribe(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </form>
            )}
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-sm text-gray-400 pt-8">
          Powered by <a href="https://oncallshift.com" className="hover:text-gray-600">OnCallShift</a>
        </footer>
      </div>
    </div>
  );
}

export default PublicStatusPage;
