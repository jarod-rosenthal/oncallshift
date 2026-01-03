import Anthropic from '@anthropic-ai/sdk';
import { getDataSource } from '../db/data-source';
import { CloudCredential } from '../models';
import {
  ImportExtraction,
  ImportContentType as ModelContentType,
} from '../models/ImportHistory';
import { decryptCredentials } from './credential-encryption';
import { logger } from '../utils/logger';
import {
  getPromptForContentType,
  IMPORT_SYSTEM_PREFIX,
  ImportContentType as PromptContentType,
} from '../prompts/import-prompts';

// Maximum image size: 10MB
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * Input for screenshot analysis
 */
export interface AnalyzeScreenshotInput {
  /** Base64-encoded image data (without data URL prefix) */
  image: string;
  /** MIME type of the image */
  mimeType: string;
  /** Source platform hint (pagerduty, opsgenie) */
  sourceType?: 'pagerduty' | 'opsgenie';
  /** Expected content type */
  contentType?: ModelContentType;
  /** Organization ID for API key lookup */
  orgId: string;
}

/**
 * Input for natural language analysis
 */
export interface AnalyzeTextInput {
  /** Natural language description */
  text: string;
  /** Organization ID for API key lookup */
  orgId: string;
}

/**
 * Error thrown when image validation fails
 */
export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

/**
 * Error thrown when extraction fails
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/**
 * Get the Anthropic API key for an organization.
 * First checks for org-specific credential, falls back to env var.
 */
async function getApiKey(orgId: string): Promise<string | null> {
  try {
    const dataSource = await getDataSource();
    const credentialRepo = dataSource.getRepository(CloudCredential);

    // Look for an enabled Anthropic credential for this org
    const credential = await credentialRepo.findOne({
      where: { orgId, provider: 'anthropic' as any, enabled: true },
    });

    if (credential) {
      const decrypted = decryptCredentials<{ api_key: string }>(
        credential.credentialsEncrypted,
        orgId
      );
      if (decrypted.api_key) {
        logger.info('Using org-specific Anthropic API key for vision import', { orgId });
        return decrypted.api_key;
      }
    }
  } catch (error) {
    logger.warn('Failed to fetch org Anthropic credential, falling back to env var', {
      orgId,
      error,
    });
  }

  // Fall back to environment variable
  return process.env.ANTHROPIC_API_KEY || null;
}

/**
 * Validate image data
 * @throws ImageValidationError if validation fails
 */
function validateImage(
  base64Data: string,
  mimeType: string
): asserts mimeType is AllowedImageType {
  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType as AllowedImageType)) {
    throw new ImageValidationError(
      `Invalid image type: ${mimeType}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    );
  }

  // Check size (base64 is ~4/3 the size of binary)
  const estimatedBytes = (base64Data.length * 3) / 4;
  if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (estimatedBytes / (1024 * 1024)).toFixed(2);
    throw new ImageValidationError(
      `Image too large: ${sizeMB}MB. Maximum allowed: 10MB`
    );
  }

  // Basic base64 validation - allow some whitespace that might be in the string
  const cleanedBase64 = base64Data.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(cleanedBase64)) {
    throw new ImageValidationError('Invalid base64 encoding');
  }
}

/**
 * Map model content type to prompt content type
 */
function mapContentType(contentType?: ModelContentType): PromptContentType | 'auto' | 'natural_language' {
  if (!contentType || contentType === 'auto' || contentType === 'mixed') {
    return 'auto';
  }
  switch (contentType) {
    case 'schedule':
      return 'schedule';
    case 'escalation':
      return 'escalation_policy';
    case 'team':
      return 'team';
    case 'service':
      return 'service';
    default:
      return 'auto';
  }
}

/**
 * Parse Claude's response into ImportExtraction format
 */
function parseExtractionResponse(responseText: string): ImportExtraction {
  // Try to extract JSON from the response
  let jsonStr = responseText;

  // Handle markdown code blocks
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    // Try to find raw JSON object
    const objectMatch = responseText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    throw new ExtractionError(
      'Failed to parse JSON from Claude response',
      parseError instanceof Error ? parseError : undefined
    );
  }

  // Extract base fields
  const confidence = typeof parsed.confidence === 'number'
    ? Math.max(0, Math.min(1, parsed.confidence))
    : 0.5;

  const sourceDetected = (['pagerduty', 'opsgenie', 'unknown'].includes(parsed.sourceDetected as string)
    ? parsed.sourceDetected
    : 'unknown') as 'pagerduty' | 'opsgenie' | 'unknown';

  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((w): w is string => typeof w === 'string')
    : [];

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.filter((s): s is string => typeof s === 'string')
    : [];

  // Extract data based on content type
  const data = (parsed.data || {}) as Record<string, unknown>;
  const contentType = parsed.contentType as string;

  // Initialize result arrays
  const teams: ImportExtraction['teams'] = [];
  const schedules: ImportExtraction['schedules'] = [];
  const escalationPolicies: ImportExtraction['escalationPolicies'] = [];
  const services: ImportExtraction['services'] = [];

  // Parse based on detected content type
  if (contentType === 'team' || contentType === 'user_list') {
    // Parse team data
    if (data.name || data.members) {
      teams.push({
        name: (data.name as string) || 'Imported Team',
        members: Array.isArray(data.members)
          ? data.members.map((m: any) => ({
              name: m.name || '',
              email: m.email,
              role: m.role,
            }))
          : [],
      });
    }
  } else if (contentType === 'schedule') {
    // Parse schedule data
    if (data.name || data.shifts || data.layers) {
      const participants = new Set<string>();

      // Extract participants from shifts
      if (Array.isArray(data.shifts)) {
        data.shifts.forEach((shift: any) => {
          if (shift.userName) participants.add(shift.userName);
        });
      }

      // Extract participants from layers
      if (Array.isArray(data.layers)) {
        data.layers.forEach((layer: any) => {
          if (Array.isArray(layer.members)) {
            layer.members.forEach((m: string) => participants.add(m));
          }
        });
      }

      schedules.push({
        name: (data.name as string) || 'Imported Schedule',
        timezone: data.timezone as string,
        rotationType: (data.rotationType as 'daily' | 'weekly' | 'custom') || 'weekly',
        handoffTime: data.handoffTime as string,
        handoffDay: typeof data.handoffDay === 'number'
          ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][data.handoffDay]
          : undefined,
        participants: Array.from(participants).map(name => ({ name })),
        layers: Array.isArray(data.layers)
          ? data.layers.map((layer: any) => ({
              name: layer.name || 'Layer',
              rotationType: layer.rotationType || 'weekly',
              participants: Array.isArray(layer.members) ? layer.members : [],
            }))
          : undefined,
      });
    }
  } else if (contentType === 'escalation_policy') {
    // Parse escalation policy data
    if (data.name || data.steps) {
      escalationPolicies.push({
        name: (data.name as string) || 'Imported Policy',
        steps: Array.isArray(data.steps)
          ? data.steps.map((step: any) => ({
              delayMinutes: step.timeoutMinutes || 5,
              targets: Array.isArray(step.targets)
                ? step.targets.map((t: any) => ({
                    type: t.type === 'schedule' ? 'schedule' : 'user',
                    name: t.name || '',
                  }))
                : [],
            }))
          : [],
      });
    }
  } else if (contentType === 'service') {
    // Parse service data
    const serviceList = Array.isArray(data.services) ? data.services : [data];
    serviceList.forEach((svc: any) => {
      if (svc.name) {
        services.push({
          name: svc.name,
          description: svc.description,
          escalationPolicyName: svc.escalationPolicyName,
          teamName: svc.teamName,
        });
      }
    });
  } else if (contentType === 'natural_language_import') {
    // Parse unified natural language extraction
    if (Array.isArray(data.teams)) {
      data.teams.forEach((team: any) => {
        teams.push({
          name: team.name || 'Imported Team',
          members: Array.isArray(team.members)
            ? team.members.map((m: any) => ({
                name: typeof m === 'string' ? m : m.name || '',
                role: typeof m === 'object' ? m.role : undefined,
              }))
            : [],
        });
      });
    }

    if (Array.isArray(data.schedules)) {
      data.schedules.forEach((sched: any) => {
        schedules.push({
          name: sched.name || 'Imported Schedule',
          rotationType: sched.rotationType || 'weekly',
          handoffTime: sched.handoffTime,
          handoffDay: typeof sched.handoffDay === 'number'
            ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][sched.handoffDay]
            : undefined,
          participants: Array.isArray(sched.members)
            ? sched.members.map((m: string) => ({ name: m }))
            : [],
        });
      });
    }

    if (Array.isArray(data.escalationPolicies)) {
      data.escalationPolicies.forEach((policy: any) => {
        escalationPolicies.push({
          name: policy.name || 'Imported Policy',
          steps: Array.isArray(policy.steps)
            ? policy.steps.map((step: any) => ({
                delayMinutes: step.timeoutMinutes || 5,
                targets: Array.isArray(step.targets)
                  ? step.targets.map((t: any) => ({
                      type: t.type === 'schedule' ? 'schedule' : 'user',
                      name: t.name || '',
                    }))
                  : [],
              }))
            : [],
        });
      });
    }

    if (Array.isArray(data.services)) {
      data.services.forEach((svc: any) => {
        if (svc.name) {
          services.push({
            name: svc.name,
            description: svc.description,
            escalationPolicyName: svc.escalationPolicyName,
            teamName: svc.teamName,
          });
        }
      });
    }
  }

  // Add warnings if no data was extracted
  if (teams.length === 0 && schedules.length === 0 &&
      escalationPolicies.length === 0 && services.length === 0) {
    warnings.push('No configuration data could be extracted from the image');
  }

  return {
    confidence,
    sourceDetected,
    teams,
    schedules,
    escalationPolicies,
    services,
    warnings,
    suggestions,
  };
}

/**
 * Analyze a screenshot using Claude Vision API
 */
async function analyzeScreenshot(input: AnalyzeScreenshotInput): Promise<ImportExtraction> {
  const { image, mimeType, sourceType, contentType, orgId } = input;

  // Validate image
  validateImage(image, mimeType);

  // Get API key
  const apiKey = await getApiKey(orgId);
  if (!apiKey) {
    throw new ExtractionError(
      'Anthropic API key is not configured. Add one in Settings > Cloud Credentials.'
    );
  }

  // Get the appropriate prompt
  const promptContentType = mapContentType(contentType);
  const prompt = getPromptForContentType(promptContentType);

  // Add source type hint if known
  let enhancedPrompt = prompt;
  if (sourceType) {
    enhancedPrompt = `${prompt}\n\nHint: This screenshot appears to be from ${sourceType.toUpperCase()}.`;
  }

  // Create Anthropic client
  const anthropic = new Anthropic({ apiKey });

  logger.info('Calling Claude Vision API for import extraction', {
    orgId,
    contentType,
    sourceType,
    mimeType,
    imageSize: image.length,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: IMPORT_SYSTEM_PREFIX,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
                data: image,
              },
            },
            {
              type: 'text',
              text: enhancedPrompt,
            },
          ],
        },
      ],
    });

    // Extract text content
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new ExtractionError('No text response from Claude Vision API');
    }

    logger.info('Claude Vision API response received', {
      orgId,
      contentType,
      responseLength: textContent.text.length,
      stopReason: response.stop_reason,
    });

    // Parse and return the extraction result
    return parseExtractionResponse(textContent.text);
  } catch (error) {
    // Handle rate limits
    if (error instanceof Anthropic.RateLimitError) {
      logger.warn('Claude API rate limit hit during vision import', { orgId });
      throw new ExtractionError(
        'Rate limit exceeded. Please try again in a few moments.',
        error
      );
    }

    // Handle other API errors
    if (error instanceof Anthropic.APIError) {
      logger.error('Claude API error during vision import', {
        orgId,
        status: error.status,
        message: error.message,
      });
      throw new ExtractionError(`Claude API error: ${error.message}`, error);
    }

    // Re-throw our own errors
    if (error instanceof ExtractionError || error instanceof ImageValidationError) {
      throw error;
    }

    // Wrap unknown errors
    throw new ExtractionError(
      `Unexpected error during extraction: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Analyze natural language text to extract configuration
 */
async function analyzeText(input: AnalyzeTextInput): Promise<ImportExtraction> {
  const { text, orgId } = input;

  // Validate input
  if (!text || text.trim().length < 10) {
    throw new ExtractionError(
      'Description too short. Please provide more details about the configuration.'
    );
  }

  // Get API key
  const apiKey = await getApiKey(orgId);
  if (!apiKey) {
    throw new ExtractionError(
      'Anthropic API key is not configured. Add one in Settings > Cloud Credentials.'
    );
  }

  // Get natural language prompt
  const prompt = getPromptForContentType('natural_language');

  // Create Anthropic client
  const anthropic = new Anthropic({ apiKey });

  logger.info('Calling Claude API for natural language import', {
    orgId,
    textLength: text.length,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: IMPORT_SYSTEM_PREFIX,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nUser description:\n${text}`,
        },
      ],
    });

    // Extract text content
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new ExtractionError('No text response from Claude API');
    }

    logger.info('Claude API response received for NL extraction', {
      orgId,
      responseLength: textContent.text.length,
      stopReason: response.stop_reason,
    });

    // Parse and return the extraction result
    return parseExtractionResponse(textContent.text);
  } catch (error) {
    // Handle rate limits
    if (error instanceof Anthropic.RateLimitError) {
      logger.warn('Claude API rate limit hit during NL import', { orgId });
      throw new ExtractionError(
        'Rate limit exceeded. Please try again in a few moments.',
        error
      );
    }

    // Handle other API errors
    if (error instanceof Anthropic.APIError) {
      logger.error('Claude API error during NL import', {
        orgId,
        status: error.status,
        message: error.message,
      });
      throw new ExtractionError(`Claude API error: ${error.message}`, error);
    }

    // Re-throw our own errors
    if (error instanceof ExtractionError) {
      throw error;
    }

    // Wrap unknown errors
    throw new ExtractionError(
      `Unexpected error during extraction: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Fetch an image from a URL and convert to base64
 */
async function fetchImageFromUrl(url: string): Promise<{ base64: string; mimeType: AllowedImageType }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OnCallShift-Import/1.0',
      },
    });

    if (!response.ok) {
      throw new ImageValidationError(
        `Failed to fetch image: HTTP ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get('content-type')?.split(';')[0] || '';
    if (!ALLOWED_IMAGE_TYPES.includes(contentType as AllowedImageType)) {
      throw new ImageValidationError(
        `Invalid image type from URL: ${contentType}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      throw new ImageValidationError(
        `Image too large: ${sizeMB}MB. Maximum allowed: 10MB`
      );
    }

    return {
      base64: buffer.toString('base64'),
      mimeType: contentType as AllowedImageType,
    };
  } catch (error) {
    if (error instanceof ImageValidationError) {
      throw error;
    }
    throw new ImageValidationError(
      `Failed to fetch image from URL: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse natural language description (alias for analyzeText matching route expectations)
 */
async function parseNaturalLanguage(input: { description: string; orgId: string }): Promise<ImportExtraction> {
  return analyzeText({ text: input.description, orgId: input.orgId });
}

/**
 * Exported service object matching the expected interface
 */
export const visionImportService = {
  analyzeScreenshot,
  analyzeText,
  parseNaturalLanguage,
  fetchImageFromUrl,
};

// Also export individual functions and types for flexibility
export { analyzeScreenshot, analyzeText, fetchImageFromUrl, getApiKey };
