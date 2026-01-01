import { logger } from '../utils/logger';

export type ConferenceBridgeProvider = 'zoom' | 'google_meet' | 'microsoft_teams' | 'manual';

export interface ConferenceBridgeConfig {
  provider: ConferenceBridgeProvider;
  zoom?: {
    accountId: string;
    clientId: string;
    clientSecret: string;
  };
  googleMeet?: {
    serviceAccountKey: string;
    calendarId: string;
  };
  microsoftTeams?: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
  };
}

export interface CreateMeetingRequest {
  topic: string;
  incidentNumber: number;
  serviceName: string;
  hostEmail?: string;
}

export interface MeetingDetails {
  provider: ConferenceBridgeProvider;
  meetingUrl: string;
  meetingId: string;
  passcode?: string;
  dialInNumber?: string;
  dialInPin?: string;
  hostUrl?: string;
  providerData?: Record<string, any>;
}

/**
 * Conference Bridge Service
 * Handles auto-provisioning of video conference meetings for incidents
 */
class ConferenceBridgeService {
  private zoomAccessToken: string | null = null;
  private zoomTokenExpiry: Date | null = null;

  /**
   * Create a meeting using the configured provider
   */
  async createMeeting(
    config: ConferenceBridgeConfig,
    request: CreateMeetingRequest
  ): Promise<MeetingDetails> {
    switch (config.provider) {
      case 'zoom':
        return this.createZoomMeeting(config.zoom!, request);
      case 'google_meet':
        return this.createGoogleMeetMeeting(config.googleMeet!, request);
      case 'microsoft_teams':
        return this.createTeamsMeeting(config.microsoftTeams!, request);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * Create a Zoom meeting
   */
  private async createZoomMeeting(
    config: { accountId: string; clientId: string; clientSecret: string },
    request: CreateMeetingRequest
  ): Promise<MeetingDetails> {
    try {
      // Get access token using Server-to-Server OAuth
      const token = await this.getZoomAccessToken(config);

      // Create meeting
      const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: `[INC-${request.incidentNumber}] ${request.topic}`,
          type: 1, // Instant meeting
          settings: {
            join_before_host: true,
            waiting_room: false,
            mute_upon_entry: false,
            auto_recording: 'none',
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Zoom API error', { status: response.status, error });
        throw new Error(`Zoom API error: ${response.status}`);
      }

      const data = await response.json() as {
        join_url: string;
        id: number;
        password?: string;
        start_url: string;
        host_key?: string;
        uuid: string;
        settings?: { global_dial_in_numbers?: Array<{ number: string }> };
      };

      return {
        provider: 'zoom',
        meetingUrl: data.join_url,
        meetingId: data.id.toString(),
        passcode: data.password,
        dialInNumber: data.settings?.global_dial_in_numbers?.[0]?.number,
        dialInPin: data.id.toString(),
        hostUrl: data.start_url,
        providerData: {
          hostKey: data.host_key,
          uuid: data.uuid,
        },
      };
    } catch (error) {
      logger.error('Failed to create Zoom meeting', { error });
      throw error;
    }
  }

  /**
   * Get Zoom access token using Server-to-Server OAuth
   */
  private async getZoomAccessToken(config: {
    accountId: string;
    clientId: string;
    clientSecret: string;
  }): Promise<string> {
    // Check if we have a valid cached token
    if (this.zoomAccessToken && this.zoomTokenExpiry && new Date() < this.zoomTokenExpiry) {
      return this.zoomAccessToken;
    }

    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const response = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${config.accountId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Zoom OAuth error: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.zoomAccessToken = data.access_token;
    this.zoomTokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

    return this.zoomAccessToken!;
  }

  /**
   * Create a Google Meet meeting
   * Note: Requires Google Workspace and Calendar API
   */
  private async createGoogleMeetMeeting(
    _config: { serviceAccountKey: string; calendarId: string },
    request: CreateMeetingRequest
  ): Promise<MeetingDetails> {
    // Google Meet requires creating a Calendar event with conferenceData
    // This is a simplified implementation - production would use googleapis library

    logger.info('Creating Google Meet meeting', { topic: request.topic });

    // For now, return a placeholder - full implementation requires Google API setup
    // In production, use: googleapis.calendar('v3').events.insert with conferenceDataVersion=1

    throw new Error('Google Meet integration requires additional setup. Please configure Google Workspace API credentials.');
  }

  /**
   * Create a Microsoft Teams meeting
   * Note: Requires Microsoft Graph API
   */
  private async createTeamsMeeting(
    config: { tenantId: string; clientId: string; clientSecret: string },
    request: CreateMeetingRequest
  ): Promise<MeetingDetails> {
    try {
      // Get access token using client credentials flow
      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials',
          }),
        }
      );

      if (!tokenResponse.ok) {
        throw new Error(`Teams OAuth error: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json() as { access_token: string };
      const accessToken = tokenData.access_token;

      // Create online meeting
      const meetingResponse = await fetch(
        'https://graph.microsoft.com/v1.0/communications/onlineMeetings',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: `[INC-${request.incidentNumber}] ${request.topic}`,
            startDateTime: new Date().toISOString(),
            endDateTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
            lobbyBypassSettings: {
              scope: 'everyone',
              isDialInBypassEnabled: true,
            },
          }),
        }
      );

      if (!meetingResponse.ok) {
        const error = await meetingResponse.text();
        logger.error('Teams API error', { status: meetingResponse.status, error });
        throw new Error(`Teams API error: ${meetingResponse.status}`);
      }

      const data = await meetingResponse.json() as {
        joinWebUrl: string;
        id: string;
        audioConferencing?: { tollNumber?: string; conferenceId?: string };
        chatInfo?: { threadId?: string };
      };

      return {
        provider: 'microsoft_teams',
        meetingUrl: data.joinWebUrl,
        meetingId: data.id,
        dialInNumber: data.audioConferencing?.tollNumber,
        dialInPin: data.audioConferencing?.conferenceId,
        providerData: {
          threadId: data.chatInfo?.threadId,
        },
      };
    } catch (error) {
      logger.error('Failed to create Teams meeting', { error });
      throw error;
    }
  }

  /**
   * End/delete a meeting
   */
  async endMeeting(
    config: ConferenceBridgeConfig,
    meetingId: string
  ): Promise<void> {
    switch (config.provider) {
      case 'zoom':
        await this.endZoomMeeting(config.zoom!, meetingId);
        break;
      // Google Meet and Teams meetings typically auto-expire
      default:
        logger.info('Meeting end not implemented for provider', { provider: config.provider });
    }
  }

  private async endZoomMeeting(
    config: { accountId: string; clientId: string; clientSecret: string },
    meetingId: string
  ): Promise<void> {
    try {
      const token = await this.getZoomAccessToken(config);

      await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      logger.info('Zoom meeting ended', { meetingId });
    } catch (error) {
      logger.error('Failed to end Zoom meeting', { meetingId, error });
    }
  }
}

export const conferenceBridgeService = new ConferenceBridgeService();
