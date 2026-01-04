import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { EscalationStatus } from '../types/api';

interface EscalationStatusPanelProps {
  escalation: EscalationStatus | null;
  onEscalateNow?: () => void;
}

export function EscalationStatusPanel({ escalation, onEscalateNow }: EscalationStatusPanelProps) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Escalation Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Policy Name */}
        <div>
          <p className="text-sm text-muted-foreground">Policy</p>
          <p className="font-medium">{escalation.policyName || 'Unknown'}</p>
        </div>

        {/* Visual Progress Bar with Steps */}
        {escalation.steps && escalation.steps.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">Progress</p>
            <div className="flex items-center gap-1">
              {escalation.steps.map((step, idx) => (
                <div key={step.position} className="flex items-center flex-1">
                  {/* Step Circle */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all ${
                        step.status === 'completed'
                          ? 'bg-green-500 border-green-500 text-white'
                          : step.status === 'active'
                          ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
                          : 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600'
                      }`}
                    >
                      {step.status === 'completed' ? '✓' : step.position}
                    </div>
                    {/* Step Label */}
                    <div className="mt-1 text-center">
                      <p className={`text-xs font-medium truncate max-w-[80px] ${
                        step.status === 'active' ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                      }`}>
                        Rule {step.position}
                      </p>
                    </div>
                  </div>
                  {/* Connector Line */}
                  {idx < escalation.steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 ${
                        step.status === 'completed'
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Countdown Timer + Next Escalation Preview */}
        {escalation.isEscalating && timeRemaining && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-orange-800 dark:text-orange-200">Next escalation in</span>
              <span className="font-mono text-lg font-bold text-orange-600 dark:text-orange-400">
                {timeRemaining}
              </span>
            </div>
            {/* Who's Next Preview */}
            {escalation.nextTargets && escalation.nextTargets.length > 0 && (
              <div className="pt-2 border-t border-orange-200 dark:border-orange-700">
                <p className="text-xs text-orange-700 dark:text-orange-300 mb-1">Will notify:</p>
                <div className="flex flex-wrap gap-2">
                  {escalation.nextTargets.map((target) => (
                    <div
                      key={target.userId}
                      className="flex items-center gap-1.5 text-sm bg-orange-100 dark:bg-orange-800/30 rounded px-2 py-1"
                    >
                      <div className="w-5 h-5 rounded-full bg-orange-200 dark:bg-orange-700 flex items-center justify-center text-orange-700 dark:text-orange-300 text-xs font-medium">
                        {target.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-orange-800 dark:text-orange-200 font-medium">{target.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* No more rules message */}
            {!escalation.nextTargets && escalation.currentStep >= escalation.totalSteps && (
              <div className="pt-2 border-t border-orange-200 dark:border-orange-700">
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  {escalation.repeatEnabled
                    ? 'Policy will restart from Rule 1'
                    : 'Last rule - escalation will stop'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Current Targets */}
        {escalation.currentTargets && escalation.currentTargets.length > 0 && (
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

        {/* Escalate Now Button */}
        {escalation.isEscalating && onEscalateNow && escalation.currentStep < escalation.totalSteps && (
          <button
            onClick={onEscalateNow}
            className="w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Escalate Now
          </button>
        )}

        {/* Not Escalating State */}
        {!escalation.isEscalating && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Escalation paused (incident acknowledged or resolved)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
