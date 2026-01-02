import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, CheckCircle, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { incidentsAPI } from '../lib/api-client';
import type { SimilarIncident } from '../lib/api-client';
import type { Incident } from '../types/api';

interface SimilarIncidentHintProps {
  currentIncident: Incident;
}

/**
 * Prominently displays the best matching similar incident with resolution hint
 * Shows above the fold on incident detail to help responders learn from past fixes
 */
export function SimilarIncidentHint({ currentIncident }: SimilarIncidentHintProps) {
  const navigate = useNavigate();
  const [bestMatch, setBestMatch] = useState<SimilarIncident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSimilarIncidents();
  }, [currentIncident.id]);

  const fetchSimilarIncidents = async () => {
    try {
      setLoading(true);
      const response = await incidentsAPI.getSimilar(currentIncident.id);
      setBestMatch(response.bestMatch);
    } catch (err) {
      console.error('Error fetching similar incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything while loading or if no match
  if (loading || !bestMatch) {
    return null;
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Similar Incident Found</CardTitle>
          </div>
          {bestMatch.similarityPercent >= 70 && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
              {bestMatch.similarityPercent}% match
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          #{bestMatch.incidentNumber} &middot; {formatTimeAgo(bestMatch.triggeredAt)}
          {bestMatch.state === 'resolved' && ' • Resolved'}
        </p>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Resolution hint - the key value */}
        {bestMatch.resolutionNote && bestMatch.state === 'resolved' && (
          <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">
                  How it was fixed:
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {truncateText(bestMatch.resolutionNote, 200)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* View button */}
        <button
          onClick={() => navigate(`/incidents/${bestMatch.id}`)}
          className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-primary border border-border rounded-md hover:bg-accent transition-colors"
        >
          View Incident #{bestMatch.incidentNumber}
          <ChevronRight className="w-4 h-4" />
        </button>
      </CardContent>
    </Card>
  );
}

export default SimilarIncidentHint;
