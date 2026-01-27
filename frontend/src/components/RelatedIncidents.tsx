import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { incidentsAPI } from '../lib/api-client';
import { getSeveritySolidColor, getStateBadgeColor } from '../lib/colors';
import type { Incident } from '../types/api';

interface RelatedIncidentsProps {
  currentIncident: Incident;
}

export function RelatedIncidents({ currentIncident }: RelatedIncidentsProps) {
  const [relatedIncidents, setRelatedIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchRelatedIncidents();
  }, [currentIncident.id]);

  const fetchRelatedIncidents = async () => {
    try {
      setIsLoading(true);
      const response = await incidentsAPI.list();
      const allIncidents = response.incidents;

      // Filter related incidents:
      // 1. Same service
      // 2. Not the current incident
      // 3. Limit to recent ones (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const related = allIncidents
        .filter(i =>
          i.id !== currentIncident.id &&
          i.service.id === currentIncident.service.id &&
          new Date(i.triggeredAt) > thirtyDaysAgo
        )
        .sort((a, b) => {
          // Score by similarity - prioritize same severity and similar summary
          const aScore = getSimilarityScore(a, currentIncident);
          const bScore = getSimilarityScore(b, currentIncident);
          return bScore - aScore;
        })
        .slice(0, 100);

      setRelatedIncidents(related);
    } catch (error) {
      console.error('Error fetching related incidents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSimilarityScore = (incident: Incident, current: Incident): number => {
    let score = 0;

    // Same severity
    if (incident.severity === current.severity) score += 2;

    // Similar summary (contains common words)
    const currentWords = current.summary.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const incidentWords = incident.summary.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const commonWords = currentWords.filter(w => incidentWords.includes(w));
    score += commonWords.length;

    // More recent = higher score
    const daysSince = (Date.now() - new Date(incident.triggeredAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) score += 2;
    else if (daysSince < 14) score += 1;

    return score;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <CardTitle className="text-lg">Related Incidents</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  // Don't show section if no related incidents
  if (relatedIncidents.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
        >
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <CardTitle className="text-lg flex-1">Related Incidents</CardTitle>
          <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full">
            {relatedIncidents.length}
          </span>
          <svg
            className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="border-t divide-y">
            {relatedIncidents.map((incident) => (
              <Link
                key={incident.id}
                to={`/incidents/${incident.id}`}
                className="flex items-center gap-3 py-3 hover:bg-accent/50 transition-colors -mx-6 px-6"
              >
                {/* Severity dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getSeveritySolidColor(incident.severity)}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{incident.summary}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${getStateBadgeColor(incident.state)}`}>
                      {incident.state}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(incident.triggeredAt)}
                    </span>
                  </div>
                </div>

                {/* Chevron */}
                <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>

          {/* Pattern hint */}
          <div className="flex items-center gap-2 mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-xs text-blue-600 dark:text-blue-400 italic">
              {relatedIncidents.length} similar incidents from {currentIncident.service.name} in the last 30 days
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
