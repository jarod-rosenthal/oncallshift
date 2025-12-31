import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { EscalationStatus } from '../types/api';

interface EscalationStatusPanelProps {
  escalation: EscalationStatus | null;
  isSnoozed: boolean;
  snoozedUntil: string | null;
}

export function EscalationStatusPanel({ escalation, isSnoozed, snoozedUntil }: EscalationStatusPanelProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!escalation?.timeoutAt || !escalation.isEscalating) {
      setTimeRemaining('');
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const timeout = new Date(escalation.timeoutAt!).getTime();
      const diff = timeout - now;

      if (diff <= 0) {
        setTimeRemaining('Escalating...');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [escalation?.timeoutAt, escalation?.isEscalating]);

  if (!escalation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Escalation Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No escalation policy configured</p>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = escalation.totalSteps > 0
    ? (escalation.currentStep / escalation.totalSteps) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Escalation Status</span>
          {isSnoozed && (
            <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              SNOOZED
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Policy Name */}
        <div>
          <p className="text-sm text-muted-foreground">Policy</p>
          <p className="font-medium">{escalation.policyName || 'Unknown'}</p>
        </div>

        {/* Level Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Level</span>
            <span className="font-medium">
              {escalation.currentStep} of {escalation.totalSteps}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Countdown Timer */}
        {escalation.isEscalating && timeRemaining && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-orange-800 dark:text-orange-200">Next escalation in</span>
              <span className="font-mono text-lg font-bold text-orange-600 dark:text-orange-400">
                {timeRemaining}
              </span>
            </div>
          </div>
        )}

        {/* Snooze Info */}
        {isSnoozed && snoozedUntil && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              Snoozed until {new Date(snoozedUntil).toLocaleString()}
            </p>
          </div>
        )}

        {/* Current Targets */}
        {escalation.currentTargets.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Currently Notifying</p>
            <div className="space-y-2">
              {escalation.currentTargets.map((target) => (
                <div
                  key={target.userId}
                  className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 rounded px-3 py-2"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                    {target.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{target.name}</p>
                    <p className="text-xs text-muted-foreground">{target.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Not Escalating State */}
        {!escalation.isEscalating && !isSnoozed && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Escalation paused (incident acknowledged or resolved)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
