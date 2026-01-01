import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Postmortem, PostmortemTemplate, Incident } from '../../shared/models';
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

      const queryBuilder = postmortemRepo
        .createQueryBuilder('postmortem')
        .leftJoinAndSelect('postmortem.incident', 'incident')
        .leftJoinAndSelect('incident.service', 'service')
        .leftJoinAndSelect('postmortem.createdBy', 'createdBy')
        .leftJoinAndSelect('postmortem.publishedBy', 'publishedBy')
        .where('postmortem.org_id = :orgId', { orgId })
        .orderBy('postmortem.created_at', 'DESC')
        .take(limit as number)
        .skip(offset as number);

      if (status) {
        queryBuilder.andWhere('postmortem.status = :status', { status });
      }

      const [postmortems, total] = await queryBuilder.getManyAndCount();

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
 * Delete a postmortem (only if draft)
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

    // Only allow deleting draft postmortems
    if (postmortem.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot delete published postmortems' });
    }

    await postmortemRepo.remove(postmortem);

    logger.info('Postmortem deleted', { postmortemId: id, orgId });

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

export default router;
