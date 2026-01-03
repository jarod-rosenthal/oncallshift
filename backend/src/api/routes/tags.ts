import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Tag, EntityTag } from '../../shared/models';
import { EntityType } from '../../shared/models/EntityTag';
import { In } from 'typeorm';
import { parsePaginationParams, paginatedResponse, validateSortField } from '../../shared/utils/pagination';
import { paginationValidators, searchFilterValidator } from '../../shared/validators/pagination';
import { notFound, internalError, validationError, conflict, badRequest, fromExpressValidator } from '../../shared/utils/problem-details';

const router = Router();

// Apply authentication to all routes
router.use(authenticateUser);

// Valid entity types for tagging
const VALID_ENTITY_TYPES: EntityType[] = [
  'service',
  'incident',
  'business_service',
  'schedule',
  'escalation_policy',
  'runbook',
  'user',
  'team',
];

// Suggested tag colors
const SUGGESTED_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#6b7280', // gray
];

/**
 * Format tag for API response
 */
function formatTag(tag: Tag) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    description: tag.description,
    usageCount: tag.usageCount,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

/**
 * GET /api/v1/tags
 * Get all tags for the organization
 */
router.get('/',
  [
    ...paginationValidators,
    searchFilterValidator,
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const pagination = parsePaginationParams(req.query);
      const sortField = validateSortField('tags', pagination.sort, 'name');
      const sortOrder = pagination.order?.toUpperCase() as 'ASC' | 'DESC' || 'ASC';

      const { search } = req.query;
      const dataSource = await getDataSource();
      const tagRepo = dataSource.getRepository(Tag);

      const queryBuilder = tagRepo.createQueryBuilder('tag')
        .where('tag.orgId = :orgId', { orgId });

      // Apply search filter
      if (search && typeof search === 'string' && search.trim()) {
        queryBuilder.andWhere('LOWER(tag.name) LIKE LOWER(:search)', {
          search: `%${search.trim()}%`,
        });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply sorting and pagination
      queryBuilder
        .orderBy(`tag.${sortField}`, sortOrder)
        .skip(pagination.offset)
        .take(pagination.limit);

      const tags = await queryBuilder.getMany();
      const mappedTags = tags.map(formatTag);

      const lastItem = tags[tags.length - 1];
      const response = paginatedResponse(
        mappedTags,
        total,
        pagination,
        lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
        'tags'
      );

      return res.json({
        ...response,
        suggestedColors: SUGGESTED_COLORS,
      });
    } catch (error) {
      console.error('Error fetching tags:', error);
      return internalError(res);
    }
  }
);

/**
 * GET /api/v1/tags/:id
 * Get a single tag by ID
 */
router.get('/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { id } = req.params;
      const dataSource = await getDataSource();
      const tagRepo = dataSource.getRepository(Tag);

      const tag = await tagRepo.findOne({
        where: { id, orgId },
      });

      if (!tag) {
        return notFound(res, 'Tag', id);
      }

      return res.json({ tag: formatTag(tag) });
    } catch (error) {
      console.error('Error fetching tag:', error);
      return internalError(res);
    }
  }
);

/**
 * POST /api/v1/tags
 * Create a new tag
 */
router.post('/',
  body('name').isString().trim().notEmpty().isLength({ max: 100 }),
  body('color').optional().isString().matches(/^#[0-9a-fA-F]{6}$/),
  body('description').optional({ nullable: true }).isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { name, color = '#6b7280', description } = req.body;
      const dataSource = await getDataSource();
      const tagRepo = dataSource.getRepository(Tag);

      // Check for duplicate name
      const existing = await tagRepo.findOne({
        where: { orgId, name: name.trim() },
      });
      if (existing) {
        return conflict(res, 'A tag with this name already exists');
      }

      const tag = tagRepo.create({
        orgId,
        name: name.trim(),
        color,
        description: description || null,
      });

      await tagRepo.save(tag);

      return res.status(201).json({
        tag: formatTag(tag),
        message: 'Tag created successfully',
      });
    } catch (error) {
      console.error('Error creating tag:', error);
      return internalError(res);
    }
  }
);

/**
 * PUT /api/v1/tags/:id
 * Update a tag
 */
router.put('/:id',
  param('id').isUUID(),
  body('name').optional().isString().trim().notEmpty().isLength({ max: 100 }),
  body('color').optional().isString().matches(/^#[0-9a-fA-F]{6}$/),
  body('description').optional({ nullable: true }).isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { id } = req.params;
      const { name, color, description } = req.body;
      const dataSource = await getDataSource();
      const tagRepo = dataSource.getRepository(Tag);

      const tag = await tagRepo.findOne({ where: { id, orgId } });
      if (!tag) {
        return notFound(res, 'Tag', id);
      }

      // Check for duplicate name if changing
      if (name && name.trim() !== tag.name) {
        const existing = await tagRepo.findOne({
          where: { orgId, name: name.trim() },
        });
        if (existing) {
          return conflict(res, 'A tag with this name already exists');
        }
      }

      if (name !== undefined) tag.name = name.trim();
      if (color !== undefined) tag.color = color;
      if (description !== undefined) tag.description = description;

      await tagRepo.save(tag);

      return res.json({
        tag: formatTag(tag),
        message: 'Tag updated successfully',
      });
    } catch (error) {
      console.error('Error updating tag:', error);
      return internalError(res);
    }
  }
);

/**
 * DELETE /api/v1/tags/:id
 * Delete a tag (removes from all entities)
 */
router.delete('/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { id } = req.params;
      const dataSource = await getDataSource();
      const tagRepo = dataSource.getRepository(Tag);

      const tag = await tagRepo.findOne({ where: { id, orgId } });
      if (!tag) {
        return notFound(res, 'Tag', id);
      }

      await tagRepo.remove(tag);

      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting tag:', error);
      return internalError(res);
    }
  }
);

// ==========================================
// Entity Tag Management
// ==========================================

/**
 * GET /api/v1/tags/entity/:entityType/:entityId
 * Get all tags for a specific entity
 */
router.get('/entity/:entityType/:entityId',
  param('entityType').isIn(VALID_ENTITY_TYPES),
  param('entityId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { entityType, entityId } = req.params;
      const dataSource = await getDataSource();
      const entityTagRepo = dataSource.getRepository(EntityTag);

      const entityTags = await entityTagRepo.find({
        where: {
          orgId,
          entityType: entityType as EntityType,
          entityId,
        },
        relations: ['tag'],
      });

      return res.json({
        tags: entityTags.map(et => formatTag(et.tag)),
      });
    } catch (error) {
      console.error('Error fetching entity tags:', error);
      return internalError(res);
    }
  }
);

/**
 * PUT /api/v1/tags/entity/:entityType/:entityId
 * Set tags for a specific entity (replaces all existing tags)
 */
router.put('/entity/:entityType/:entityId',
  param('entityType').isIn(VALID_ENTITY_TYPES),
  param('entityId').isUUID(),
  body('tagIds').isArray(),
  body('tagIds.*').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { entityType, entityId } = req.params;
      const { tagIds } = req.body;
      const dataSource = await getDataSource();
      const tagRepo = dataSource.getRepository(Tag);
      const entityTagRepo = dataSource.getRepository(EntityTag);

      // Verify all tags exist and belong to org
      if (tagIds.length > 0) {
        const tags = await tagRepo.find({
          where: { id: In(tagIds), orgId },
        });
        if (tags.length !== tagIds.length) {
          return badRequest(res, 'One or more tags not found');
        }
      }

      // Remove existing tags for this entity
      await entityTagRepo.delete({
        orgId,
        entityType: entityType as EntityType,
        entityId,
      });

      // Add new tags
      if (tagIds.length > 0) {
        const newEntityTags = tagIds.map((tagId: string) => entityTagRepo.create({
          orgId,
          tagId,
          entityType: entityType as EntityType,
          entityId,
        }));
        await entityTagRepo.save(newEntityTags);
      }

      // Fetch updated tags
      const updatedEntityTags = await entityTagRepo.find({
        where: {
          orgId,
          entityType: entityType as EntityType,
          entityId,
        },
        relations: ['tag'],
      });

      return res.json({
        tags: updatedEntityTags.map(et => formatTag(et.tag)),
        message: 'Entity tags updated successfully',
      });
    } catch (error) {
      console.error('Error updating entity tags:', error);
      return internalError(res);
    }
  }
);

/**
 * POST /api/v1/tags/entity/:entityType/:entityId/add
 * Add a single tag to an entity
 */
router.post('/entity/:entityType/:entityId/add',
  param('entityType').isIn(VALID_ENTITY_TYPES),
  param('entityId').isUUID(),
  body('tagId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { entityType, entityId } = req.params;
      const { tagId } = req.body;
      const dataSource = await getDataSource();
      const tagRepo = dataSource.getRepository(Tag);
      const entityTagRepo = dataSource.getRepository(EntityTag);

      // Verify tag exists
      const tag = await tagRepo.findOne({ where: { id: tagId, orgId } });
      if (!tag) {
        return notFound(res, 'Tag', tagId);
      }

      // Check if already tagged
      const existing = await entityTagRepo.findOne({
        where: {
          tagId,
          entityType: entityType as EntityType,
          entityId,
        },
      });
      if (existing) {
        return conflict(res, 'Entity already has this tag');
      }

      const entityTag = entityTagRepo.create({
        orgId,
        tagId,
        entityType: entityType as EntityType,
        entityId,
      });
      await entityTagRepo.save(entityTag);

      return res.status(201).json({
        tag: formatTag(tag),
        message: 'Tag added to entity',
      });
    } catch (error) {
      console.error('Error adding tag to entity:', error);
      return internalError(res);
    }
  }
);

/**
 * DELETE /api/v1/tags/entity/:entityType/:entityId/:tagId
 * Remove a single tag from an entity
 */
router.delete('/entity/:entityType/:entityId/:tagId',
  param('entityType').isIn(VALID_ENTITY_TYPES),
  param('entityId').isUUID(),
  param('tagId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { entityType, entityId, tagId } = req.params;
      const dataSource = await getDataSource();
      const entityTagRepo = dataSource.getRepository(EntityTag);

      const entityTag = await entityTagRepo.findOne({
        where: {
          orgId,
          tagId,
          entityType: entityType as EntityType,
          entityId,
        },
      });

      if (!entityTag) {
        return notFound(res, 'Entity tag');
      }

      await entityTagRepo.remove(entityTag);

      return res.status(204).send();
    } catch (error) {
      console.error('Error removing tag from entity:', error);
      return internalError(res);
    }
  }
);

/**
 * GET /api/v1/tags/:id/entities
 * Get all entities that have a specific tag
 */
router.get('/:id/entities',
  param('id').isUUID(),
  query('entityType').optional().isIn(VALID_ENTITY_TYPES),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { id } = req.params;
      const { entityType } = req.query;
      const dataSource = await getDataSource();
      const tagRepo = dataSource.getRepository(Tag);
      const entityTagRepo = dataSource.getRepository(EntityTag);

      // Verify tag exists
      const tag = await tagRepo.findOne({ where: { id, orgId } });
      if (!tag) {
        return notFound(res, 'Tag', id);
      }

      const whereClause: any = { orgId, tagId: id };
      if (entityType) {
        whereClause.entityType = entityType;
      }

      const entityTags = await entityTagRepo.find({
        where: whereClause,
        order: { entityType: 'ASC', createdAt: 'DESC' },
      });

      // Group by entity type
      const grouped: Record<string, string[]> = {};
      for (const et of entityTags) {
        if (!grouped[et.entityType]) {
          grouped[et.entityType] = [];
        }
        grouped[et.entityType].push(et.entityId);
      }

      return res.json({
        tag: formatTag(tag),
        entities: grouped,
        totalCount: entityTags.length,
      });
    } catch (error) {
      console.error('Error fetching tag entities:', error);
      return internalError(res);
    }
  }
);

/**
 * POST /api/v1/tags/bulk
 * Create multiple tags at once
 */
router.post('/bulk',
  body('tags').isArray({ min: 1, max: 50 }),
  body('tags.*.name').isString().trim().notEmpty().isLength({ max: 100 }),
  body('tags.*.color').optional().isString().matches(/^#[0-9a-fA-F]{6}$/),
  body('tags.*.description').optional({ nullable: true }).isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { tags: tagData } = req.body;
      const dataSource = await getDataSource();
      const tagRepo = dataSource.getRepository(Tag);

      const created: Tag[] = [];
      const skipped: string[] = [];

      for (const td of tagData) {
        const existing = await tagRepo.findOne({
          where: { orgId, name: td.name.trim() },
        });
        if (existing) {
          skipped.push(td.name);
          continue;
        }

        const tag = tagRepo.create({
          orgId,
          name: td.name.trim(),
          color: td.color || '#6b7280',
          description: td.description || null,
        });
        await tagRepo.save(tag);
        created.push(tag);
      }

      return res.status(201).json({
        tags: created.map(formatTag),
        skipped,
        message: `Created ${created.length} tags, skipped ${skipped.length} duplicates`,
      });
    } catch (error) {
      console.error('Error bulk creating tags:', error);
      return internalError(res);
    }
  }
);

/**
 * POST /api/v1/tags/seed-defaults
 * Seed default tags for a new organization
 */
router.post('/seed-defaults', async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const dataSource = await getDataSource();
    const tagRepo = dataSource.getRepository(Tag);

    const defaults = [
      { name: 'production', color: '#ef4444', description: 'Production environment' },
      { name: 'staging', color: '#f59e0b', description: 'Staging environment' },
      { name: 'development', color: '#22c55e', description: 'Development environment' },
      { name: 'critical', color: '#dc2626', description: 'Critical priority' },
      { name: 'database', color: '#3b82f6', description: 'Database related' },
      { name: 'api', color: '#8b5cf6', description: 'API related' },
      { name: 'frontend', color: '#ec4899', description: 'Frontend related' },
      { name: 'infrastructure', color: '#6366f1', description: 'Infrastructure related' },
    ];

    const created: Tag[] = [];

    for (const td of defaults) {
      const existing = await tagRepo.findOne({
        where: { orgId, name: td.name },
      });
      if (existing) continue;

      const tag = tagRepo.create({
        orgId,
        ...td,
      });
      await tagRepo.save(tag);
      created.push(tag);
    }

    return res.status(201).json({
      tags: created.map(formatTag),
      message: `Created ${created.length} default tags`,
    });
  } catch (error) {
    console.error('Error seeding default tags:', error);
    return internalError(res);
  }
});

export default router;
