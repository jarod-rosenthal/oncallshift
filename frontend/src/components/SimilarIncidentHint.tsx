import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, CheckCircle, ChevronRight } from 'lucide-react';
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
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                Similar Incident Found
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                #{bestMatch.incidentNumber} &middot; {formatTimeAgo(bestMatch.triggeredAt)}
                {bestMatch.state === 'resolved' && ' \u2022 Resolved'}
              </p>
            </div>

            {bestMatch.similarityPercent >= 70 && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
                {bestMatch.similarityPercent}% match
              </span>
            )}
          </div>

          {/* Resolution hint - the key value */}
          {bestMatch.resolutionNote && bestMatch.state === 'resolved' && (
            <div className="mt-3 p-3 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">
                    How it was fixed:
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {truncateText(bestMatch.resolutionNote, 200)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* View button */}
          <button
            onClick={() => navigate(`/incidents/${bestMatch.id}`)}
            className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            View Incident #{bestMatch.incidentNumber}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimilarIncidentHint;
