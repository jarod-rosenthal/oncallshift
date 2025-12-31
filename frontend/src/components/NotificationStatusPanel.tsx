import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { incidentsAPI } from '../lib/api-client';

interface NotificationChannel {
  channel: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
}

interface UserNotification {
  userId: string;
  userName: string;
  userEmail: string;
  channels: NotificationChannel[];
}

interface NotificationStatusPanelProps {
  incidentId: string;
}

export function NotificationStatusPanel({ incidentId }: NotificationStatusPanelProps) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, [incidentId]);

  const loadNotifications = async () => {
    try {
      const data = await incidentsAPI.getNotifications(incidentId);
      setNotifications(data.notifications);
      setSummary(data.summary);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <span className="text-green-500">✓</span>;
      case 'sent':
        return <span className="text-blue-500">↗</span>;
      case 'pending':
        return <span className="text-yellow-500">⏳</span>;
      case 'failed':
        return <span className="text-red-500">✗</span>;
      default:
        return <span className="text-gray-400">?</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'sent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'push':
        return '📱';
      case 'email':
        return '📧';
      case 'sms':
        return '💬';
      case 'voice':
        return '📞';
      default:
        return '📨';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No notifications sent yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Notification Status</span>
          {summary && (
            <div className="flex gap-2 text-xs">
              {summary.delivered > 0 && (
                <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {summary.delivered} delivered
                </span>
              )}
              {summary.sent > 0 && (
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {summary.sent} sent
                </span>
              )}
              {summary.pending > 0 && (
                <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  {summary.pending} pending
                </span>
              )}
              {summary.failed > 0 && (
                <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {summary.failed} failed
                </span>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.map((userNotification) => (
          <div
            key={userNotification.userId}
            className="border rounded-lg p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                {userNotification.userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-sm">{userNotification.userName}</p>
                <p className="text-xs text-muted-foreground">{userNotification.userEmail}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {userNotification.channels.map((channel, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${getStatusColor(channel.status)}`}
                  title={channel.errorMessage || undefined}
                >
                  <span>{getChannelIcon(channel.channel)}</span>
                  <span className="capitalize">{channel.channel}</span>
                  {getStatusIcon(channel.status)}
                </div>
              ))}
            </div>
            {userNotification.channels.some(c => c.errorMessage) && (
              <div className="mt-2">
                {userNotification.channels
                  .filter(c => c.errorMessage)
                  .map((c, idx) => (
                    <p key={idx} className="text-xs text-red-600 dark:text-red-400">
                      {c.channel}: {c.errorMessage}
                    </p>
                  ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
