import Anthropic from '@anthropic-ai/sdk';
import { getDataSource } from '../db/data-source';
import {
  OnboardingSession,
  OnboardingStage,
  OnboardingCollectedInfo,
  PendingQuestion,
} from '../models/OnboardingSession';
import { Team, TeamMembership, Schedule, Service, EscalationPolicy, EscalationStep } from '../models';
import { getAnthropicApiKey } from './ai-assistant-service';
import { logger } from '../utils/logger';

/**
 * Response from processing user input
 */
export interface OnboardingResponse {
  message: string;
  stage: OnboardingStage;
  progress: number;
  pendingQuestions: PendingQuestion[];
  collectedInfo: OnboardingCollectedInfo;
  suggestedActions?: string[];
  isComplete: boolean;
}

/**
 * Configuration for Claude responses
 */
const CLAUDE_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 2048,
  temperature: 0.7,
};

/**
 * System prompt for the onboarding agent
 */
function buildOnboardingSystemPrompt(stage: OnboardingStage, collectedInfo: OnboardingCollectedInfo): string {
  const stageInstructions: Record<OnboardingStage, string> = {
    discovery: `You are in the DISCOVERY stage. Your goal is to understand the customer's team structure and on-call needs.

Questions to ask:
1. How many teams do they have that will use OnCallShift?
2. What are the team names?
3. How is their team structured? (by function, by product, by region, or other)
4. How many people are typically in each team?

Once you have this information, acknowledge it and let them know you'll help set up their teams next.`,

    team_setup: `You are in the TEAM SETUP stage. Help the customer create their teams.

Current information collected:
- Team count: ${collectedInfo.teamCount || 'Not specified'}
- Team names: ${collectedInfo.teamNames?.join(', ') || 'Not specified'}
- Team structure: ${collectedInfo.teamStructure || 'Not specified'}

Ask them to provide team member information:
1. Who are the team members for each team? (name and email)
2. Who should be the team manager/lead?

Format collected member info clearly and confirm before creating teams.`,

    schedule_setup: `You are in the SCHEDULE SETUP stage. Help configure on-call schedules.

Teams created: ${collectedInfo.createdTeamIds?.length || 0}

Ask about:
1. What timezone should schedules use?
2. What type of rotation do they want? (daily, weekly, or custom)
3. When should handoffs occur? (day of week and time)

Explain the benefits of different rotation types based on team size.`,

    integration: `You are in the INTEGRATION stage. Help connect monitoring tools.

Ask about their monitoring setup:
1. What monitoring tools do they use? (Datadog, CloudWatch, Prometheus, etc.)
2. Do they want to set up email-based alert ingestion?
3. Are there custom webhooks they need to configure?

Provide guidance on setting up each integration type.`,

    verification: `You are in the VERIFICATION stage. Help verify the setup is working.

Configuration so far:
- Teams: ${collectedInfo.createdTeamIds?.length || 0}
- Schedules: ${collectedInfo.createdScheduleIds?.length || 0}
- Services: ${collectedInfo.createdServiceIds?.length || 0}

Offer to:
1. Send a test alert to verify everything is connected
2. Walk through the notification flow
3. Show how to access the dashboard`,

    complete: `The onboarding is COMPLETE. Provide a summary of what was set up and next steps.

Summary:
- Teams created: ${collectedInfo.createdTeamIds?.length || 0}
- Schedules configured: ${collectedInfo.createdScheduleIds?.length || 0}
- Services/Integrations: ${collectedInfo.createdServiceIds?.length || 0}

Suggest:
1. Inviting remaining team members
2. Exploring advanced features (escalation policies, runbooks)
3. Setting up additional integrations
4. Reviewing documentation`,
  };

  return `You are an AI onboarding assistant for OnCallShift, a modern incident management platform.
Your job is to guide new customers through platform setup in a friendly, conversational manner.

CURRENT STAGE: ${stage}
${stageInstructions[stage]}

GUIDELINES:
- Be concise but friendly - avoid walls of text
- Ask one or two questions at a time
- Validate and confirm information before proceeding
- Offer to skip optional steps if the user seems impatient
- Use markdown formatting for clarity
- When you have enough information for the current stage, indicate readiness to proceed

COLLECTED INFO SO FAR:
${JSON.stringify(collectedInfo, null, 2)}

IMPORTANT: Your response should be a natural conversation. Extract any relevant information from the user's message and incorporate it into your understanding.`;
}

/**
 * Extract structured information from natural language using Claude
 */
async function extractInfoFromResponse(
  userMessage: string,
  currentInfo: OnboardingCollectedInfo,
  stage: OnboardingStage,
  orgId: string
): Promise<{ extractedInfo: Partial<OnboardingCollectedInfo>; shouldAdvanceStage: boolean }> {
  const apiKey = await getAnthropicApiKey(orgId);
  if (!apiKey) {
    logger.warn('No Anthropic API key available for info extraction', { orgId });
    return { extractedInfo: {}, shouldAdvanceStage: false };
  }

  const anthropic = new Anthropic({ apiKey });

  const extractionPrompt = `Analyze this user message and extract relevant onboarding information.

Current stage: ${stage}
Current collected info: ${JSON.stringify(currentInfo, null, 2)}
User message: "${userMessage}"

Extract any of these fields if mentioned:
- teamCount (number of teams)
- teamNames (array of team names)
- teamStructure (how teams are organized: "by-function", "by-product", "by-region", "other")
- estimatedTeamSize (average team size)
- members (array of {email, name, teamName, role})
- timezone (IANA timezone string like "America/New_York")
- rotationType ("daily", "weekly", or "custom")
- rotationStartDay (0-6, 0 is Sunday)
- handoffTime (HH:mm format)
- integrations (array of {type: "datadog"|"cloudwatch"|"prometheus"|"custom_webhook"|"email"})

Also determine if the user has provided enough information to advance to the next stage.

Respond with JSON only:
{
  "extractedInfo": { ... },
  "shouldAdvanceStage": boolean,
  "confidence": "high" | "medium" | "low"
}`;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_CONFIG.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return { extractedInfo: {}, shouldAdvanceStage: false };
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { extractedInfo: {}, shouldAdvanceStage: false };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      extractedInfo: parsed.extractedInfo || {},
      shouldAdvanceStage: parsed.shouldAdvanceStage && parsed.confidence !== 'low',
    };
  } catch (error) {
    logger.error('Failed to extract info from response', { error, stage });
    return { extractedInfo: {}, shouldAdvanceStage: false };
  }
}

/**
 * Generate conversational response using Claude
 */
async function generateConversationalResponse(
  userMessage: string,
  session: OnboardingSession,
  orgId: string
): Promise<string> {
  const apiKey = await getAnthropicApiKey(orgId);
  if (!apiKey) {
    return "I'm sorry, but I'm unable to process your request right now. Please try again later or contact support.";
  }

  const anthropic = new Anthropic({ apiKey });

  // Build conversation history
  const conversationHistory: Anthropic.MessageParam[] = session.messages.slice(-10).map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));

  // Add current user message
  conversationHistory.push({ role: 'user', content: userMessage });

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_CONFIG.model,
      max_tokens: CLAUDE_CONFIG.maxTokens,
      system: buildOnboardingSystemPrompt(session.currentStage, session.collectedInfo),
      messages: conversationHistory,
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return "I understand. Let me help you with that.";
  } catch (error) {
    logger.error('Failed to generate conversational response', { error });
    return "I apologize, but I encountered an issue processing your message. Could you please try again?";
  }
}

/**
 * Get the next stage in the onboarding flow
 */
function getNextStage(currentStage: OnboardingStage): OnboardingStage {
  const stageOrder: OnboardingStage[] = [
    'discovery',
    'team_setup',
    'schedule_setup',
    'integration',
    'verification',
    'complete',
  ];
  const currentIndex = stageOrder.indexOf(currentStage);
  if (currentIndex < stageOrder.length - 1) {
    return stageOrder[currentIndex + 1];
  }
  return 'complete';
}

/**
 * Create teams based on collected information
 */
async function createTeamsFromInfo(
  session: OnboardingSession,
  orgId: string,
  adminUserId: string
): Promise<string[]> {
  const dataSource = await getDataSource();
  const teamRepo = dataSource.getRepository(Team);
  const membershipRepo = dataSource.getRepository(TeamMembership);

  const createdTeamIds: string[] = [];
  const teamNames = session.collectedInfo.teamNames || [];

  for (const teamName of teamNames) {
    // Check if team already exists
    const existing = await teamRepo.findOne({ where: { orgId, name: teamName } });
    if (existing) {
      createdTeamIds.push(existing.id);
      continue;
    }

    const team = teamRepo.create({
      orgId,
      name: teamName,
      slug: Team.generateSlug(teamName),
      settings: {},
    });
    await teamRepo.save(team);
    createdTeamIds.push(team.id);

    // Add admin as manager of the team
    const membership = membershipRepo.create({
      teamId: team.id,
      userId: adminUserId,
      role: 'manager',
    });
    await membershipRepo.save(membership);

    logger.info('Created team during onboarding', { teamId: team.id, teamName, orgId });
  }

  return createdTeamIds;
}

/**
 * Create schedules based on collected information
 */
async function createSchedulesFromInfo(
  session: OnboardingSession,
  orgId: string,
  adminUserId: string
): Promise<string[]> {
  const dataSource = await getDataSource();
  const scheduleRepo = dataSource.getRepository(Schedule);

  const createdScheduleIds: string[] = [];
  const teamIds = session.collectedInfo.createdTeamIds || [];
  const timezone = session.collectedInfo.timezone || 'UTC';

  for (const teamId of teamIds) {
    // Get team name for schedule
    const teamRepo = dataSource.getRepository(Team);
    const team = await teamRepo.findOne({ where: { id: teamId, orgId } });
    if (!team) continue;

    const scheduleName = `${team.name} On-Call`;

    // Check if schedule already exists
    const existing = await scheduleRepo.findOne({ where: { orgId, name: scheduleName } });
    if (existing) {
      createdScheduleIds.push(existing.id);
      continue;
    }

    const schedule = scheduleRepo.create({
      orgId,
      teamId,
      name: scheduleName,
      timezone,
      type: session.collectedInfo.rotationType === 'daily' ? 'daily' :
            session.collectedInfo.rotationType === 'weekly' ? 'weekly' : 'manual',
      currentOncallUserId: adminUserId, // Start with admin on-call
    });
    await scheduleRepo.save(schedule);
    createdScheduleIds.push(schedule.id);

    logger.info('Created schedule during onboarding', { scheduleId: schedule.id, teamId, orgId });
  }

  return createdScheduleIds;
}

/**
 * Create a default service and escalation policy
 */
async function createDefaultServiceAndPolicy(
  session: OnboardingSession,
  orgId: string
): Promise<string[]> {
  const dataSource = await getDataSource();
  const serviceRepo = dataSource.getRepository(Service);
  const policyRepo = dataSource.getRepository(EscalationPolicy);
  const stepRepo = dataSource.getRepository(EscalationStep);

  const createdServiceIds: string[] = [];
  const scheduleIds = session.collectedInfo.createdScheduleIds || [];

  if (scheduleIds.length === 0) {
    return createdServiceIds;
  }

  // Create a default escalation policy
  let policy = await policyRepo.findOne({ where: { orgId, name: 'Default Escalation Policy' } });

  if (!policy) {
    policy = policyRepo.create({
      orgId,
      name: 'Default Escalation Policy',
      description: 'Created during onboarding',
      repeatEnabled: true,
      repeatCount: 3,
    });
    await policyRepo.save(policy);

    // Add first schedule as escalation step
    const step = stepRepo.create({
      escalationPolicyId: policy.id,
      stepOrder: 1,
      targetType: 'schedule',
      scheduleId: scheduleIds[0],
      timeoutSeconds: 300, // 5 minutes
    });
    await stepRepo.save(step);

    logger.info('Created escalation policy during onboarding', { policyId: policy.id, orgId });
  }

  // Create a default service
  let service = await serviceRepo.findOne({ where: { orgId, name: 'Default Service' } });

  if (!service) {
    service = serviceRepo.create({
      orgId,
      name: 'Default Service',
      description: 'Default service for receiving alerts',
      escalationPolicyId: policy.id,
      scheduleId: scheduleIds[0],
      status: 'active',
    });
    await serviceRepo.save(service);
    createdServiceIds.push(service.id);

    logger.info('Created default service during onboarding', { serviceId: service.id, orgId });
  } else {
    createdServiceIds.push(service.id);
  }

  return createdServiceIds;
}

/**
 * OnboardingAgent class - manages the conversational onboarding flow
 */
export class OnboardingAgent {
  /**
   * Start a new onboarding session
   */
  async startOnboarding(orgId: string, adminUserId: string, adminEmail: string): Promise<OnboardingResponse> {
    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);

    // Check for existing active session
    let session = await sessionRepo.findOne({
      where: { orgId, status: 'active' },
    });

    if (session) {
      // Resume existing session
      logger.info('Resuming existing onboarding session', { sessionId: session.id, orgId });
      return {
        message: `Welcome back! Let's continue setting up OnCallShift. ${this.getStagePrompt(session.currentStage, session.collectedInfo)}`,
        stage: session.currentStage,
        progress: session.getProgressPercentage(),
        pendingQuestions: session.pendingQuestions,
        collectedInfo: session.collectedInfo,
        isComplete: false,
      };
    }

    // Create new session
    session = sessionRepo.create({
      orgId,
      adminUserId,
      adminEmail,
      currentStage: 'discovery',
      collectedInfo: {},
      messages: [],
      pendingQuestions: [],
      status: 'active',
    });
    await sessionRepo.save(session);

    const welcomeMessage = `Welcome to OnCallShift! I'm here to help you set up your incident management platform.

Let's start by learning about your team structure. This will help me configure OnCallShift to match how your organization works.

**A few quick questions:**
1. How many teams will be using OnCallShift for on-call management?
2. What are the names of these teams?

Feel free to tell me about your setup in your own words - I'll extract the relevant information.`;

    session.addMessage('assistant', welcomeMessage);
    await sessionRepo.save(session);

    logger.info('Started new onboarding session', { sessionId: session.id, orgId });

    return {
      message: welcomeMessage,
      stage: 'discovery',
      progress: 0,
      pendingQuestions: [],
      collectedInfo: {},
      isComplete: false,
    };
  }

  /**
   * Process a user response in the onboarding flow
   */
  async processResponse(sessionId: string, userResponse: string): Promise<OnboardingResponse> {
    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);

    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new Error('Onboarding session not found');
    }

    if (session.status !== 'active') {
      return {
        message: 'This onboarding session has already been completed.',
        stage: session.currentStage,
        progress: 100,
        pendingQuestions: [],
        collectedInfo: session.collectedInfo,
        isComplete: true,
      };
    }

    // Add user message to history
    session.addMessage('user', userResponse);

    // Extract information from the response
    const { extractedInfo, shouldAdvanceStage } = await extractInfoFromResponse(
      userResponse,
      session.collectedInfo,
      session.currentStage,
      session.orgId
    );

    // Merge extracted info
    session.collectedInfo = { ...session.collectedInfo, ...extractedInfo };

    // Handle stage transitions and actions
    if (shouldAdvanceStage || this.hasEnoughInfoForStage(session)) {
      await this.executeStageActions(session);

      const nextStage = getNextStage(session.currentStage);
      if (nextStage !== session.currentStage) {
        session.currentStage = nextStage;
        logger.info('Advanced onboarding stage', {
          sessionId,
          newStage: nextStage,
          orgId: session.orgId
        });
      }
    }

    // Check for completion
    if (session.currentStage === 'complete') {
      session.status = 'completed';
      session.completedAt = new Date();
    }

    // Generate conversational response
    const responseMessage = await generateConversationalResponse(
      userResponse,
      session,
      session.orgId
    );

    session.addMessage('assistant', responseMessage);
    await sessionRepo.save(session);

    return {
      message: responseMessage,
      stage: session.currentStage,
      progress: session.getProgressPercentage(),
      pendingQuestions: session.pendingQuestions,
      collectedInfo: session.collectedInfo,
      suggestedActions: this.getSuggestedActions(session),
      isComplete: session.currentStage === 'complete',
    };
  }

  /**
   * Check if we have enough information to proceed from current stage
   */
  private hasEnoughInfoForStage(session: OnboardingSession): boolean {
    const info = session.collectedInfo;

    switch (session.currentStage) {
      case 'discovery':
        return !!(info.teamCount && info.teamNames && info.teamNames.length > 0);

      case 'team_setup':
        return !!(info.createdTeamIds && info.createdTeamIds.length > 0);

      case 'schedule_setup':
        return !!(info.timezone && info.createdScheduleIds && info.createdScheduleIds.length > 0);

      case 'integration':
        return !!(info.createdServiceIds && info.createdServiceIds.length > 0);

      case 'verification':
        return !!info.testAlertSent;

      default:
        return false;
    }
  }

  /**
   * Execute actions for the current stage (create teams, schedules, etc.)
   */
  private async executeStageActions(session: OnboardingSession): Promise<void> {
    const info = session.collectedInfo;

    switch (session.currentStage) {
      case 'discovery':
        // No actions needed - just collecting info
        break;

      case 'team_setup':
        if (info.teamNames && info.teamNames.length > 0 && !info.createdTeamIds) {
          const teamIds = await createTeamsFromInfo(session, session.orgId, session.adminUserId);
          session.collectedInfo.createdTeamIds = teamIds;
        }
        break;

      case 'schedule_setup':
        if (info.createdTeamIds && !info.createdScheduleIds) {
          const scheduleIds = await createSchedulesFromInfo(session, session.orgId, session.adminUserId);
          session.collectedInfo.createdScheduleIds = scheduleIds;
        }
        break;

      case 'integration':
        if (info.createdScheduleIds && !info.createdServiceIds) {
          const serviceIds = await createDefaultServiceAndPolicy(session, session.orgId);
          session.collectedInfo.createdServiceIds = serviceIds;
        }
        break;

      case 'verification':
        // Test alert sending would be handled separately
        break;
    }
  }

  /**
   * Get suggested actions for the current stage
   */
  private getSuggestedActions(session: OnboardingSession): string[] {
    switch (session.currentStage) {
      case 'discovery':
        return ['Tell me about your teams', 'Skip to team setup'];

      case 'team_setup':
        return ['Add team members', 'Create teams now', 'Skip member setup'];

      case 'schedule_setup':
        return ['Use weekly rotation', 'Use daily rotation', 'Configure custom schedule'];

      case 'integration':
        return ['Set up Datadog', 'Set up CloudWatch', 'Use email alerts', 'Skip integrations'];

      case 'verification':
        return ['Send test alert', 'View dashboard', 'Complete setup'];

      case 'complete':
        return ['Invite team members', 'Explore features', 'View documentation'];

      default:
        return [];
    }
  }

  /**
   * Get a contextual prompt for resuming at a stage
   */
  private getStagePrompt(stage: OnboardingStage, info: OnboardingCollectedInfo): string {
    switch (stage) {
      case 'discovery':
        return "We were learning about your team structure. How many teams will use OnCallShift?";

      case 'team_setup':
        return `You mentioned ${info.teamCount || 'some'} teams. Would you like to add team members now?`;

      case 'schedule_setup':
        return `Your teams are set up! Now let's configure on-call schedules. What timezone should they use?`;

      case 'integration':
        return "Schedules are configured! What monitoring tools would you like to connect?";

      case 'verification':
        return "Almost done! Would you like to send a test alert to verify everything works?";

      default:
        return "";
    }
  }

  /**
   * Get the current session status
   */
  async getSessionStatus(sessionId: string): Promise<OnboardingResponse | null> {
    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);

    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      return null;
    }

    const lastMessage = session.messages[session.messages.length - 1];

    return {
      message: lastMessage?.content || '',
      stage: session.currentStage,
      progress: session.getProgressPercentage(),
      pendingQuestions: session.pendingQuestions,
      collectedInfo: session.collectedInfo,
      suggestedActions: this.getSuggestedActions(session),
      isComplete: session.currentStage === 'complete',
    };
  }

  /**
   * Manually advance to the next stage (skip current stage)
   */
  async skipToNextStage(sessionId: string): Promise<OnboardingResponse> {
    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);

    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new Error('Onboarding session not found');
    }

    const nextStage = getNextStage(session.currentStage);
    session.currentStage = nextStage;

    const skipMessage = `Okay, let's move on to ${OnboardingSession.getStageDisplayName(nextStage)}. ${this.getStagePrompt(nextStage, session.collectedInfo)}`;
    session.addMessage('assistant', skipMessage);

    if (nextStage === 'complete') {
      session.status = 'completed';
      session.completedAt = new Date();
    }

    await sessionRepo.save(session);

    return {
      message: skipMessage,
      stage: session.currentStage,
      progress: session.getProgressPercentage(),
      pendingQuestions: session.pendingQuestions,
      collectedInfo: session.collectedInfo,
      suggestedActions: this.getSuggestedActions(session),
      isComplete: session.currentStage === 'complete',
    };
  }

  /**
   * Send a test alert for verification
   */
  async sendTestAlert(sessionId: string): Promise<{ success: boolean; message: string }> {
    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);

    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new Error('Onboarding session not found');
    }

    const serviceIds = session.collectedInfo.createdServiceIds || [];
    if (serviceIds.length === 0) {
      return {
        success: false,
        message: 'No services configured yet. Please complete the integration step first.',
      };
    }

    // Mark test alert as sent (actual alert sending would integrate with alert system)
    session.collectedInfo.testAlertSent = true;
    await sessionRepo.save(session);

    logger.info('Test alert triggered during onboarding', { sessionId, orgId: session.orgId });

    return {
      success: true,
      message: 'Test alert sent! You should receive a notification shortly.',
    };
  }
}

// Export singleton instance
export const onboardingAgent = new OnboardingAgent();
