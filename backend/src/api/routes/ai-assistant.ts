import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getDataSource } from '../../shared/db/data-source';
import { Incident, CloudCredential, AIConversation, AIConversationMessage } from '../../shared/models';
import { authenticateUser } from '../../shared/auth/middleware';
import {
  streamAssistantChat,
  buildSystemPrompt,
  buildInitialPrompt,
  AssistantContext,
} from '../../shared/services/ai-assistant-service';
import { logger } from '../../shared/utils/logger';

const router = Router();

interface ChatRequest {
  message: string;
  conversation_id?: string;
  credential_ids?: string[];
}

/**
 * POST /incidents/:id/assistant/chat
 * Start or continue a conversation with the AI assistant
 * Returns Server-Sent Events stream
 */
router.post('/:id/assistant/chat', authenticateUser, async (req: Request, res: Response) => {
  const incidentId = req.params.id;
  const userId = req.user!.id;
  const orgId = req.user!.orgId;
  const { message, conversation_id, credential_ids }: ChatRequest = req.body;

  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);
  const credentialRepo = dataSource.getRepository(CloudCredential);
  const conversationRepo = dataSource.getRepository(AIConversation);
  const messageRepo = dataSource.getRepository(AIConversationMessage);

  try {
    // Load incident
    const incident = await incidentRepo.findOne({
      where: { id: incidentId, orgId },
      relations: ['service'],
    });

    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }

    // Load available cloud credentials
    let availableCredentials: Array<{
      id: string;
      name: string;
      provider: 'aws' | 'azure' | 'gcp';
    }> = [];

    if (credential_ids && credential_ids.length > 0) {
      const credentials = await credentialRepo
        .createQueryBuilder('cred')
        .where('cred.orgId = :orgId', { orgId })
        .andWhere('cred.id IN (:...ids)', { ids: credential_ids })
        .andWhere('cred.enabled = :enabled', { enabled: true })
        .getMany();

      availableCredentials = credentials.map(c => ({
        id: c.id,
        name: c.name,
        provider: c.provider,
      }));
    }

    // Load or create conversation
    let conversation: AIConversation;
    let existingMessages: AIConversationMessage[] = [];

    if (conversation_id) {
      const existing = await conversationRepo.findOne({
        where: { id: conversation_id, incidentId, orgId },
      });
      if (!existing) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      conversation = existing;

      // Load existing messages
      existingMessages = await messageRepo.find({
        where: { conversationId: conversation_id },
        order: { createdAt: 'ASC' },
      });
    } else {
      // Create new conversation
      conversation = conversationRepo.create({
        orgId,
        incidentId,
        userId,
        status: 'active',
      });
      await conversationRepo.save(conversation);
    }

    // Build message history for Claude
    const claudeMessages: Anthropic.MessageParam[] = [];

    // Add existing messages
    for (const msg of existingMessages) {
      if (msg.role === 'user') {
        claudeMessages.push({ role: 'user', content: msg.content || '' });
      } else if (msg.role === 'assistant') {
        claudeMessages.push({ role: 'assistant', content: msg.content || '' });
      } else if (msg.role === 'tool_result' && msg.toolOutput) {
        // Tool results need special handling
        claudeMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.toolInput?.tool_use_id || 'unknown',
            content: JSON.stringify(msg.toolOutput),
          }],
        });
      }
    }

    // Add new user message
    claudeMessages.push({ role: 'user', content: message });

    // Save user message to database
    const userMessage = messageRepo.create({
      conversationId: conversation.id,
      role: 'user',
      content: message,
    });
    await messageRepo.save(userMessage);

    // Build context
    const context: AssistantContext = {
      incidentId,
      userId,
      orgId,
      availableCredentials,
    };

    const systemPrompt = buildSystemPrompt(context);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send conversation ID first
    res.write(`data: ${JSON.stringify({ type: 'conversation_id', id: conversation.id })}\n\n`);

    let fullAssistantResponse = '';
    const toolCalls: Array<{ name: string; input: any; output: any }> = [];

    // Stream the response
    try {
      for await (const event of streamAssistantChat(claudeMessages, context, systemPrompt)) {
        switch (event.type) {
          case 'text':
            fullAssistantResponse += event.content;
            res.write(`data: ${JSON.stringify({ type: 'text', content: event.content })}\n\n`);
            break;

          case 'tool_call':
            res.write(`data: ${JSON.stringify({
              type: 'tool_call',
              tool: event.toolName,
              input: event.toolInput,
            })}\n\n`);
            break;

          case 'tool_result':
            toolCalls.push({
              name: event.toolName,
              input: event.result,
              output: event.result,
            });
            res.write(`data: ${JSON.stringify({
              type: 'tool_result',
              tool: event.toolName,
              success: event.result.success,
              summary: event.result.success
                ? `Retrieved data from ${event.toolName}`
                : `Error: ${event.result.error}`,
            })}\n\n`);
            break;

          case 'done':
            res.write(`data: ${JSON.stringify({
              type: 'done',
              conversation_id: conversation.id,
            })}\n\n`);
            break;

          case 'error':
            res.write(`data: ${JSON.stringify({
              type: 'error',
              error: event.error,
            })}\n\n`);
            break;
        }
      }

      // Save assistant response to database
      if (fullAssistantResponse) {
        const assistantMessage = messageRepo.create({
          conversationId: conversation.id,
          role: 'assistant',
          content: fullAssistantResponse,
        });
        await messageRepo.save(assistantMessage);
      }

      // Save tool calls
      for (const toolCall of toolCalls) {
        const toolMessage = messageRepo.create({
          conversationId: conversation.id,
          role: 'tool_call',
          toolName: toolCall.name,
          toolInput: toolCall.input,
          toolOutput: toolCall.output,
        });
        await messageRepo.save(toolMessage);
      }

      // Update conversation timestamp
      conversation.updatedAt = new Date();
      await conversationRepo.save(conversation);

    } catch (streamError: any) {
      logger.error('Stream error', { error: streamError.message, incidentId });
      res.write(`data: ${JSON.stringify({ type: 'error', error: streamError.message })}\n\n`);
    }

    res.end();

  } catch (error: any) {
    logger.error('Assistant chat error', { error: error.message, incidentId });
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

/**
 * GET /incidents/:id/assistant/prompt
 * Get the default prompt for starting a conversation
 */
router.get('/:id/assistant/prompt', authenticateUser, async (req: Request, res: Response) => {
  const incidentId = req.params.id;
  const orgId = req.user!.orgId;

  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);
  const credentialRepo = dataSource.getRepository(CloudCredential);

  try {
    // Load incident
    const incident = await incidentRepo.findOne({
      where: { id: incidentId, orgId },
      relations: ['service'],
    });

    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }

    // Load available cloud credentials
    const credentials = await credentialRepo.find({
      where: { orgId, enabled: true },
      select: ['id', 'name', 'provider'],
    });

    // Build default prompt
    const defaultPrompt = buildInitialPrompt(incident, incident.service);

    res.json({
      prompt: defaultPrompt,
      incident: {
        id: incident.id,
        number: incident.incidentNumber,
        summary: incident.summary,
        severity: incident.severity,
        state: incident.state,
        service: incident.service?.name || null,
      },
      available_credentials: credentials.map(c => ({
        id: c.id,
        name: c.name,
        provider: c.provider,
      })),
    });

  } catch (error: any) {
    logger.error('Get prompt error', { error: error.message, incidentId });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /incidents/:id/assistant/conversations
 * List conversations for an incident
 */
router.get('/:id/assistant/conversations', authenticateUser, async (req: Request, res: Response) => {
  const incidentId = req.params.id;
  const orgId = req.user!.orgId;

  const dataSource = await getDataSource();
  const conversationRepo = dataSource.getRepository(AIConversation);

  try {
    const conversations = await conversationRepo.find({
      where: { incidentId, orgId },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    res.json({
      conversations: conversations.map(c => ({
        id: c.id,
        status: c.status,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
        user: {
          id: c.user?.id,
          name: c.user?.fullName,
        },
      })),
    });

  } catch (error: any) {
    logger.error('List conversations error', { error: error.message, incidentId });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /incidents/:id/assistant/conversations/:conversationId
 * Get a specific conversation with messages
 */
router.get('/:id/assistant/conversations/:conversationId', authenticateUser, async (req: Request, res: Response) => {
  const { id: incidentId, conversationId } = req.params;
  const orgId = req.user!.orgId;

  const dataSource = await getDataSource();
  const conversationRepo = dataSource.getRepository(AIConversation);
  const messageRepo = dataSource.getRepository(AIConversationMessage);

  try {
    const conversation = await conversationRepo.findOne({
      where: { id: conversationId, incidentId, orgId },
      relations: ['user'],
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const messages = await messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });

    res.json({
      conversation: {
        id: conversation.id,
        status: conversation.status,
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
        user: {
          id: conversation.user?.id,
          name: conversation.user?.fullName,
        },
      },
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        tool_name: m.toolName,
        tool_input: m.toolInput,
        tool_output: m.toolOutput,
        created_at: m.createdAt,
      })),
    });

  } catch (error: any) {
    logger.error('Get conversation error', { error: error.message, conversationId });
    res.status(500).json({ error: error.message });
  }
});

export default router;
