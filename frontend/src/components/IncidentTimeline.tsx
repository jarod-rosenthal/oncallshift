import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { getEventIcon, getEventColor } from '../lib/colors';
import type { IncidentEvent } from '../types/api';

interface IncidentTimelineProps {
  events: IncidentEvent[];
  isLoading?: boolean;
}

// Simple markdown-like renderer for notes
function renderNoteContent(content: string) {
  // Split by lines and process each
  const lines = content.split('\n');

  return lines.map((line, idx) => {
    // Handle horizontal rules (---)
    if (line.trim() === '---') {
      return <hr key={idx} className="my-2 border-gray-300 dark:border-gray-600" />;
    }

    // Handle bold text (**text**)
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const renderedLine = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    return (
      <span key={idx}>
        {renderedLine}
        {idx < lines.length - 1 && '\n'}
      </span>
    );
  });
}

export function IncidentTimeline({ events, isLoading }: IncidentTimelineProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Loading timeline...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {!events || events.length === 0 ? (
          <p className="text-muted-foreground text-sm">No events yet</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={event.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs border ${getEventColor(event.type)}`}
                  >
                    {getEventIcon(event.type)}
                  </div>

                  {/* Event content */}
                  <div className={`rounded-lg border p-3 ${index === events.length - 1 ? getEventColor(event.type) : 'bg-background'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {event.type === 'note' ? (
                          <div className="text-sm whitespace-pre-wrap leading-relaxed">
                            {renderNoteContent(event.message)}
                          </div>
                        ) : (
                          <p className="text-sm font-medium">{event.message}</p>
                        )}
                        {event.actor && (
                          <p className="text-xs text-muted-foreground mt-1">
                            by {event.actor.fullName || event.actor.email}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground" title={formatTime(event.createdAt)}>
                          {formatRelativeTime(event.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Payload details for escalate events */}
                    {event.type === 'escalate' && event.payload && (
                      <div className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 rounded p-2">
                        <span className="text-muted-foreground">
                          Step {event.payload.fromStep} → Step {event.payload.toStep}
                          {event.payload.reason && ` (${event.payload.reason})`}
                        </span>
                      </div>
                    )}

                    {/* Payload details for reassign events */}
                    {event.type === 'reassign' && event.payload && (
                      <div className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 rounded p-2">
                        <span className="text-muted-foreground">
                          {event.payload.fromUserName ? `${event.payload.fromUserName} → ` : ''}
                          {event.payload.toUserName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
