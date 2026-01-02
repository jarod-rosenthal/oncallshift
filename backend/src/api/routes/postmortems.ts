import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Postmortem, PostmortemTemplate, Incident, IncidentEvent } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/postmortems
 * List all postmortems for the organization
 */
router.get(
  '/',
  [
    query('status').optional().isIn(['draft', 'in_review', 'published']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { status, limit = 50, offset = 0 } = req.query;

      const dataSource = await getDataSource();
      const postmortemRepo = dataSource.getRepository(Postmortem);

      // Use find() instead of queryBuilder to avoid TypeORM join bugs
      const whereClause: any = { orgId };
      if (status) {
        whereClause.status = status;
      }

      const [postmortems, total] = await postmortemRepo.findAndCount({
        where: whereClause,
        relations: ['incident', 'incident.service', 'createdBy', 'publishedBy'],
        order: { createdAt: 'DESC' },
        take: limit as number,
        skip: offset as number,
      });

      logger.info('Postmortems fetched', { orgId, total, count: postmortems.length });

      return res.json({
        postmortems: postmortems.map(formatPostmortem),
        pagination: {
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      logger.error('Error fetching postmortems:', error);
      return res.status(500).json({ error: 'Failed to fetch postmortems' });
    }
  }
);

/**
 * GET /api/v1/postmortems/:id
 * Get postmortem details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const postmortemRepo = dataSource.getRepository(Postmortem);

    const postmortem = await postmortemRepo.findOne({
      where: { id, orgId },
      relations: ['incident', 'incident.service', 'createdBy', 'publishedBy'],
    });

    if (!postmortem) {
      return res.status(404).json({ error: 'Postmortem not found' });
    }

    return res.json({ postmortem: formatPostmortem(postmortem) });
  } catch (error) {
    logger.error('Error fetching postmortem:', error);
    return res.status(500).json({ error: 'Failed to fetch postmortem' });
  }
});

/**
 * POST /api/v1/postmortems
 * Create a new postmortem from an incident
 */
router.post(
  '/',
  [
    body('incidentId').isUUID().withMessage('Valid incident ID is required'),
    body('title').isString().trim().notEmpty().withMessage('Title is required'),
    body('summary').optional().isString(),
    body('timeline').optional().isArray(),
    body('rootCause').optional().isString(),
    body('contributingFactors').optional().isArray(),
    body('impact').optional().isString(),
    body('whatWentWell').optional().isString(),
    body('whatCouldBeImproved').optional().isString(),
    body('actionItems').optional().isArray(),
    body('templateId').optional().isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const {
        incidentId,
        title,
        summary,
        timeline,
        rootCause,
        contributingFactors,
        impact,
        whatWentWell,
        whatCouldBeImproved,
        actionItems,
        templateId,
      } = req.body;

      const dataSource = await getDataSource();
      const postmortemRepo = dataSource.getRepository(Postmortem);
      const incidentRepo = dataSource.getRepository(Incident);

      // Verify incident exists and belongs to org
      const incident = await incidentRepo.findOne({
        where: { id: incidentId, orgId },
      });

      if (!incident) {
        return res.status(400).json({ error: 'Incident not found or does not belong to your organization' });
      }

      // Check if postmortem already exists for this incident
      const existingPostmortem = await postmortemRepo.findOne({
        where: { incidentId, orgId },
      });

      if (existingPostmortem) {
        return res.status(400).json({ error: 'Postmortem already exists for this incident' });
      }

      // Create postmortem
      const postmortem = postmortemRepo.create({
        id: uuidv4(),
        orgId,
        incidentId,
        title,
        summary: summary || null,
        timeline: timeline || [],
        rootCause: rootCause || null,
        contributingFactors: contributingFactors || [],
        impact: impact || null,
        whatWentWell: whatWentWell || null,
        whatCouldBeImproved: whatCouldBeImproved || null,
        actionItems: actionItems || [],
        templateId: templateId || null,
        createdById: userId,
        status: 'draft',
      });

      await postmortemRepo.save(postmortem);

      // Fetch postmortem with relations
      const createdPostmortem = await postmortemRepo.findOne({
        where: { id: postmortem.id },
        relations: ['incident', 'incident.service', 'createdBy'],
      });

      logger.info('Postmortem created', { postmortemId: postmortem.id, incidentId, orgId });

      return res.status(201).json({
        postmortem: formatPostmortem(createdPostmortem!),
      });
    } catch (error) {
      logger.error('Error creating postmortem:', error);
      return res.status(500).json({ error: 'Failed to create postmortem' });
    }
  }
);

/**
 * PUT /api/v1/postmortems/:id
 * Update a postmortem (only if draft or in_review)
 */
router.put(
  '/:id',
  [
    body('title').optional().isString().trim().notEmpty(),
    body('summary').optional().isString(),
    body('timeline').optional().isArray(),
    body('rootCause').optional().isString(),
    body('contributingFactors').optional().isArray(),
    body('impact').optional().isString(),
    body('whatWentWell').optional().isString(),
    body('whatCouldBeImproved').optional().isString(),
    body('actionItems').optional().isArray(),
    body('status').optional().isIn(['draft', 'in_review']),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const {
        title,
        summary,
        timeline,
        rootCause,
        contributingFactors,
        impact,
        whatWentWell,
        whatCouldBeImproved,
        actionItems,
        status,
      } = req.body;

      const dataSource = await getDataSource();
      const postmortemRepo = dataSource.getRepository(Postmortem);

      const postmortem = await postmortemRepo.findOne({
        where: { id, orgId },
      });

      if (!postmortem) {
        return res.status(404).json({ error: 'Postmortem not found' });
      }

      // Only allow editing non-published postmortems
      if (postmortem.status === 'published') {
        return res.status(400).json({ error: 'Cannot edit published postmortems' });
      }

      // Update fields
      if (title !== undefined) postmortem.title = title;
      if (summary !== undefined) postmortem.summary = summary;
      if (timeline !== undefined) postmortem.timeline = timeline;
      if (rootCause !== undefined) postmortem.rootCause = rootCause;
      if (contributingFactors !== undefined) postmortem.contributingFactors = contributingFactors;
      if (impact !== undefined) postmortem.impact = impact;
      if (whatWentWell !== undefined) postmortem.whatWentWell = whatWentWell;
      if (whatCouldBeImproved !== undefined) postmortem.whatCouldBeImproved = whatCouldBeImproved;
      if (actionItems !== undefined) postmortem.actionItems = actionItems;
      if (status !== undefined) postmortem.status = status;

      await postmortemRepo.save(postmortem);

      // Fetch updated postmortem with relations
      const updatedPostmortem = await postmortemRepo.findOne({
        where: { id },
        relations: ['incident', 'incident.service', 'createdBy', 'publishedBy'],
      });

      logger.info('Postmortem updated', { postmortemId: id, orgId });

      return res.json({
        postmortem: formatPostmortem(updatedPostmortem!),
      });
    } catch (error) {
      logger.error('Error updating postmortem:', error);
      return res.status(500).json({ error: 'Failed to update postmortem' });
    }
  }
);

/**
 * POST /api/v1/postmortems/:id/publish
 * Publish a postmortem (makes it read-only)
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const userId = req.user!.id;

    const dataSource = await getDataSource();
    const postmortemRepo = dataSource.getRepository(Postmortem);

    const postmortem = await postmortemRepo.findOne({
      where: { id, orgId },
    });

    if (!postmortem) {
      return res.status(404).json({ error: 'Postmortem not found' });
    }

    if (postmortem.status === 'published') {
      return res.status(400).json({ error: 'Postmortem is already published' });
    }

    // Update to published
    postmortem.status = 'published';
    postmortem.publishedAt = new Date();
    postmortem.publishedById = userId;

    await postmortemRepo.save(postmortem);

    // Fetch updated postmortem with relations
    const updatedPostmortem = await postmortemRepo.findOne({
      where: { id },
      relations: ['incident', 'incident.service', 'createdBy', 'publishedBy'],
    });

    logger.info('Postmortem published', { postmortemId: id, orgId });

    return res.json({
      postmortem: formatPostmortem(updatedPostmortem!),
      message: 'Postmortem published successfully',
    });
  } catch (error) {
    logger.error('Error publishing postmortem:', error);
    return res.status(500).json({ error: 'Failed to publish postmortem' });
  }
});

/**
 * DELETE /api/v1/postmortems/:id
 * Delete a postmortem
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const postmortemRepo = dataSource.getRepository(Postmortem);

    const postmortem = await postmortemRepo.findOne({
      where: { id, orgId },
    });

    if (!postmortem) {
      return res.status(404).json({ error: 'Postmortem not found' });
    }

    const wasPublished = postmortem.status === 'published';
    await postmortemRepo.remove(postmortem);

    logger.info('Postmortem deleted', { postmortemId: id, orgId, wasPublished });

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting postmortem:', error);
    return res.status(500).json({ error: 'Failed to delete postmortem' });
  }
});

/**
 * GET /api/v1/postmortem-templates
 * List all postmortem templates
 */
router.get('/templates/list', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const templateRepo = dataSource.getRepository(PostmortemTemplate);

    const templates = await templateRepo.find({
      where: { orgId },
      relations: ['createdBy'],
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    return res.json({
      templates: templates.map(formatTemplate),
    });
  } catch (error) {
    logger.error('Error fetching postmortem templates:', error);
    return res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * POST /api/v1/postmortem-templates
 * Create a new postmortem template
 */
router.post(
  '/templates',
  [
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('description').optional().isString(),
    body('sections').isArray().withMessage('Sections must be an array'),
    body('sections.*.id').isString().notEmpty(),
    body('sections.*.title').isString().notEmpty(),
    body('sections.*.prompt').isString(),
    body('sections.*.required').isBoolean(),
    body('sections.*.order').isInt({ min: 0 }),
    body('isDefault').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const { name, description, sections, isDefault } = req.body;

      const dataSource = await getDataSource();
      const templateRepo = dataSource.getRepository(PostmortemTemplate);

      // If setting as default, unset other defaults
      if (isDefault) {
        await templateRepo.update(
          { orgId, isDefault: true },
          { isDefault: false }
        );
      }

      // Create template
      const template = templateRepo.create({
        id: uuidv4(),
        orgId,
        name,
        description: description || null,
        sections,
        isDefault: isDefault || false,
        createdById: userId,
      });

      await templateRepo.save(template);

      // Fetch template with relations
      const createdTemplate = await templateRepo.findOne({
        where: { id: template.id },
        relations: ['createdBy'],
      });

      logger.info('Postmortem template created', { templateId: template.id, orgId });

      return res.status(201).json({
        template: formatTemplate(createdTemplate!),
      });
    } catch (error) {
      logger.error('Error creating postmortem template:', error);
      return res.status(500).json({ error: 'Failed to create template' });
    }
  }
);

/**
 * GET /api/v1/postmortems/templates/:id
 * Get a single postmortem template
 */
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const templateRepo = dataSource.getRepository(PostmortemTemplate);

    const template = await templateRepo.findOne({
      where: { id, orgId },
      relations: ['createdBy'],
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.json({ template: formatTemplate(template) });
  } catch (error) {
    logger.error('Error fetching postmortem template:', error);
    return res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * PUT /api/v1/postmortems/templates/:id
 * Update a postmortem template
 */
router.put(
  '/templates/:id',
  [
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('sections').optional().isArray(),
    body('isDefault').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { name, description, sections, isDefault } = req.body;

      const dataSource = await getDataSource();
      const templateRepo = dataSource.getRepository(PostmortemTemplate);

      const template = await templateRepo.findOne({
        where: { id, orgId },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await templateRepo.update(
          { orgId, isDefault: true },
          { isDefault: false }
        );
      }

      // Update fields
      if (name !== undefined) template.name = name;
      if (description !== undefined) template.description = description;
      if (sections !== undefined) template.sections = sections;
      if (isDefault !== undefined) template.isDefault = isDefault;

      await templateRepo.save(template);

      // Fetch updated template with relations
      const updatedTemplate = await templateRepo.findOne({
        where: { id },
        relations: ['createdBy'],
      });

      logger.info('Postmortem template updated', { templateId: id, orgId });

      return res.json({
        template: formatTemplate(updatedTemplate!),
      });
    } catch (error) {
      logger.error('Error updating postmortem template:', error);
      return res.status(500).json({ error: 'Failed to update template' });
    }
  }
);

/**
 * DELETE /api/v1/postmortems/templates/:id
 * Delete a postmortem template
 */
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const templateRepo = dataSource.getRepository(PostmortemTemplate);

    const template = await templateRepo.findOne({
      where: { id, orgId },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await templateRepo.remove(template);

    logger.info('Postmortem template deleted', { templateId: id, orgId });

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting postmortem template:', error);
    return res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * Format postmortem for API response
 */
function formatPostmortem(postmortem: Postmortem) {
  return {
    id: postmortem.id,
    incident_id: postmortem.incidentId,
    incident: postmortem.incident ? {
      id: postmortem.incident.id,
      incident_number: postmortem.incident.incidentNumber,
      summary: postmortem.incident.summary,
      service: postmortem.incident.service ? {
        id: postmortem.incident.service.id,
        name: postmortem.incident.service.name,
      } : null,
    } : null,
    title: postmortem.title,
    status: postmortem.status,
    summary: postmortem.summary,
    timeline: postmortem.timeline,
    root_cause: postmortem.rootCause,
    contributing_factors: postmortem.contributingFactors,
    impact: postmortem.impact,
    what_went_well: postmortem.whatWentWell,
    what_could_be_improved: postmortem.whatCouldBeImproved,
    action_items: postmortem.actionItems,
    custom_sections: postmortem.customSections,
    template_id: postmortem.templateId,
    created_by: postmortem.createdBy ? {
      id: postmortem.createdBy.id,
      full_name: postmortem.createdBy.fullName,
      email: postmortem.createdBy.email,
    } : null,
    published_by: postmortem.publishedBy ? {
      id: postmortem.publishedBy.id,
      full_name: postmortem.publishedBy.fullName,
      email: postmortem.publishedBy.email,
    } : null,
    created_at: postmortem.createdAt,
    updated_at: postmortem.updatedAt,
    published_at: postmortem.publishedAt,
  };
}

/**
 * Format template for API response
 */
function formatTemplate(template: PostmortemTemplate) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    sections: template.sections,
    is_default: template.isDefault,
    created_by: template.createdBy ? {
      id: template.createdBy.id,
      full_name: template.createdBy.fullName,
      email: template.createdBy.email,
    } : null,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  };
}

/**
 * POST /api/v1/postmortems/seed-examples
 * Seed sample postmortems from resolved incidents (for demo/testing)
 */
router.post('/seed-examples', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const userId = req.user!.id;

    const dataSource = await getDataSource();
    const postmortemRepo = dataSource.getRepository(Postmortem);
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);

    // Find resolved incidents without postmortems
    const resolvedIncidents = await incidentRepo.find({
      where: { orgId, state: 'resolved' },
      relations: ['service'],
      order: { resolvedAt: 'DESC' },
      take: 5,
    });

    if (resolvedIncidents.length === 0) {
      return res.status(400).json({ error: 'No resolved incidents found to create postmortems from' });
    }

    const createdPostmortems = [];

    for (const incident of resolvedIncidents) {
      // Check if postmortem already exists
      const existing = await postmortemRepo.findOne({
        where: { incidentId: incident.id, orgId },
      });

      if (existing) continue;

      // Get incident events for timeline
      const events = await eventRepo.find({
        where: { incidentId: incident.id },
        order: { createdAt: 'ASC' },
      });

      const timeline = events
        .filter(e => ['triggered', 'acknowledged', 'resolved', 'escalated'].includes(e.type))
        .map(e => ({
          timestamp: e.createdAt.toISOString(),
          event: e.type.charAt(0).toUpperCase() + e.type.slice(1),
          description: e.message || undefined,
        }));

      // Sample root causes and learnings
      const rootCauses = [
        'Memory leak in the connection pool caused gradual resource exhaustion',
        'Database query timeout due to missing index on high-traffic table',
        'Misconfigured rate limiter allowed traffic spike to overwhelm the service',
        'Certificate expiration was not properly monitored',
        'Deployment introduced regression in error handling logic',
      ];

      const whatWentWell = [
        'Incident was detected quickly by our monitoring systems',
        'On-call engineer responded within SLA',
        'Communication was clear and stakeholders were kept informed',
        'Rollback procedure worked as expected',
        'Team collaboration was excellent during the incident',
      ];

      const improvements = [
        'Add more comprehensive integration tests',
        'Implement better monitoring for this failure mode',
        'Create runbook for faster diagnosis',
        'Add circuit breaker to prevent cascade failures',
        'Improve alerting thresholds to catch issues earlier',
      ];

      const randomIndex = Math.floor(Math.random() * rootCauses.length);

      // Get resolution note from events (stored as note event with [Resolution Note] prefix)
      const resolutionNoteEvent = events.find(
        e => e.type === 'note' && e.message?.startsWith('[Resolution Note]')
      );
      const resolutionNote = resolutionNoteEvent?.message?.replace('[Resolution Note] ', '') || null;

      const postmortem = postmortemRepo.create({
        orgId,
        incidentId: incident.id,
        title: `Postmortem: ${incident.summary}`,
        summary: resolutionNote || `Investigation and resolution of incident #${incident.incidentNumber}`,
        timeline,
        rootCause: rootCauses[randomIndex],
        contributingFactors: ['System complexity', 'Insufficient monitoring'],
        impact: `Severity: ${incident.severity || 'Medium'}. Service ${incident.service?.name || 'Unknown'} was affected.`,
        whatWentWell: whatWentWell[randomIndex],
        whatCouldBeImproved: improvements[randomIndex],
        actionItems: [
          {
            id: `action-${uuidv4().slice(0, 8)}`,
            description: 'Add monitoring for this failure mode',
            completed: false,
          },
          {
            id: `action-${uuidv4().slice(0, 8)}`,
            description: 'Update runbook with lessons learned',
            completed: true,
            completedAt: new Date().toISOString(),
          },
        ],
        createdById: userId,
        status: Math.random() > 0.5 ? 'published' : 'draft',
        publishedAt: Math.random() > 0.5 ? new Date() : null,
        publishedById: Math.random() > 0.5 ? userId : null,
      });

      await postmortemRepo.save(postmortem);
      createdPostmortems.push(postmortem);
    }

    logger.info('Sample postmortems seeded', { orgId, count: createdPostmortems.length });

    return res.json({
      message: `Created ${createdPostmortems.length} sample postmortems from resolved incidents`,
      postmortems: createdPostmortems.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
      })),
    });
  } catch (error) {
    logger.error('Error seeding sample postmortems:', error);
    return res.status(500).json({ error: 'Failed to seed sample postmortems' });
  }
});

export default router;
