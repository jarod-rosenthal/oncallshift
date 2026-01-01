import { DataSource } from 'typeorm';
import { User } from '../models/User';
import { ObjectPermission, ObjectType, PermissionLevel } from '../models/ObjectPermission';
import { TeamMemberRole } from '../models/TeamMemberRole';
import { Team } from '../models/Team';
import { logger } from '../utils/logger';

/**
 * Permission Service - Centralized RBAC permission checking
 *
 * Implements PagerDuty-compatible role-based access control with:
 * - Base roles (organization-wide)
 * - Team roles (per-team overrides)
 * - Object permissions (fine-grained resource access)
 */
export class PermissionService {
  constructor(private dataSource: DataSource) {}

  /**
   * Check if user can view a specific object
   */
  async canViewObject(
    userId: string,
    objectType: ObjectType,
    objectId: string
  ): Promise<boolean> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'baseRole', 'orgId'],
    });

    if (!user) {
      return false;
    }

    // Owners and admins have unrestricted access
    if (user.hasUnrestrictedAccess()) {
      return true;
    }

    // Check object-level permissions
    return await this.hasObjectPermission(user.id, objectType, objectId, 'view');
  }

  /**
   * Check if user can edit a specific object
   */
  async canEditObject(
    userId: string,
    objectType: ObjectType,
    objectId: string
  ): Promise<boolean> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'baseRole', 'orgId'],
    });

    if (!user) {
      return false;
    }

    // Owners and admins have unrestricted access
    if (user.hasUnrestrictedAccess()) {
      return true;
    }

    // Managers and responders need explicit edit permission
    return await this.hasObjectPermission(user.id, objectType, objectId, 'edit');
  }

  /**
   * Check if user can manage (delete, grant permissions) a specific object
   */
  async canManageObject(
    userId: string,
    objectType: ObjectType,
    objectId: string
  ): Promise<boolean> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'baseRole', 'orgId'],
    });

    if (!user) {
      return false;
    }

    // Owners and admins have unrestricted access
    if (user.hasUnrestrictedAccess()) {
      return true;
    }

    // Others need explicit manage permission
    return await this.hasObjectPermission(user.id, objectType, objectId, 'manage');
  }

  /**
   * Check if user has a specific permission level for an object
   * Considers both direct user permissions and team permissions
   */
  private async hasObjectPermission(
    userId: string,
    objectType: ObjectType,
    objectId: string,
    requiredLevel: PermissionLevel
  ): Promise<boolean> {
    const permRepo = this.dataSource.getRepository(ObjectPermission);

    // Check direct user permission
    const userPerm = await permRepo.findOne({
      where: {
        objectType,
        objectId,
        subjectType: 'user',
        subjectId: userId,
      },
    });

    if (userPerm && this.hasRequiredLevel(userPerm.permissionLevel, requiredLevel)) {
      return true;
    }

    // Check team permissions
    const teamMemberRoles = await this.dataSource
      .getRepository(TeamMemberRole)
      .find({
        where: { userId },
        select: ['teamId'],
      });

    const teamIds = teamMemberRoles.map(tmr => tmr.teamId);

    if (teamIds.length > 0) {
      const teamPerms = await permRepo.find({
        where: {
          objectType,
          objectId,
          subjectType: 'team',
        },
      });

      for (const teamPerm of teamPerms) {
        if (
          teamIds.includes(teamPerm.subjectId) &&
          this.hasRequiredLevel(teamPerm.permissionLevel, requiredLevel)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a permission level meets the required level
   * manage >= edit >= view
   */
  private hasRequiredLevel(
    actual: PermissionLevel,
    required: PermissionLevel
  ): boolean {
    const levels: Record<PermissionLevel, number> = {
      view: 1,
      edit: 2,
      manage: 3,
    };

    return levels[actual] >= levels[required];
  }

  /**
   * Get all objects a user can view of a specific type
   */
  async getViewableObjects(
    userId: string,
    orgId: string,
    objectType: ObjectType
  ): Promise<string[]> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'baseRole'],
    });

    if (!user) {
      return [];
    }

    // Owners and admins see everything - return null to indicate "all"
    if (user.hasUnrestrictedAccess()) {
      return []; // Empty array means "filter not needed"
    }

    const permRepo = this.dataSource.getRepository(ObjectPermission);

    // Get direct user permissions
    const userPerms = await permRepo.find({
      where: {
        orgId,
        objectType,
        subjectType: 'user',
        subjectId: userId,
      },
      select: ['objectId'],
    });

    const objectIds = new Set(userPerms.map(p => p.objectId));

    // Get team permissions
    const teamMemberRoles = await this.dataSource
      .getRepository(TeamMemberRole)
      .find({
        where: { userId },
        select: ['teamId'],
      });

    const teamIds = teamMemberRoles.map(tmr => tmr.teamId);

    if (teamIds.length > 0) {
      const teamPerms = await permRepo.find({
        where: {
          orgId,
          objectType,
          subjectType: 'team',
        },
        select: ['objectId', 'subjectId'],
      });

      for (const teamPerm of teamPerms) {
        if (teamIds.includes(teamPerm.subjectId)) {
          objectIds.add(teamPerm.objectId);
        }
      }
    }

    return Array.from(objectIds);
  }

  /**
   * Grant permission to a user or team for an object
   */
  async grantPermission(
    orgId: string,
    objectType: ObjectType,
    objectId: string,
    subjectType: 'user' | 'team',
    subjectId: string,
    permissionLevel: PermissionLevel,
    grantedBy: string
  ): Promise<ObjectPermission> {
    const permRepo = this.dataSource.getRepository(ObjectPermission);

    // Check if permission already exists
    let permission = await permRepo.findOne({
      where: {
        objectType,
        objectId,
        subjectType,
        subjectId,
      },
    });

    if (permission) {
      // Update existing permission
      permission.permissionLevel = permissionLevel;
      permission.createdBy = grantedBy;
    } else {
      // Create new permission
      permission = permRepo.create({
        orgId,
        objectType,
        objectId,
        subjectType,
        subjectId,
        permissionLevel,
        createdBy: grantedBy,
      });
    }

    await permRepo.save(permission);

    logger.info('Permission granted', {
      objectType,
      objectId,
      subjectType,
      subjectId,
      permissionLevel,
      grantedBy,
    });

    return permission;
  }

  /**
   * Revoke permission from a user or team for an object
   */
  async revokePermission(
    objectType: ObjectType,
    objectId: string,
    subjectType: 'user' | 'team',
    subjectId: string
  ): Promise<boolean> {
    const permRepo = this.dataSource.getRepository(ObjectPermission);

    const result = await permRepo.delete({
      objectType,
      objectId,
      subjectType,
      subjectId,
    });

    logger.info('Permission revoked', {
      objectType,
      objectId,
      subjectType,
      subjectId,
      affected: result.affected || 0,
    });

    return (result.affected || 0) > 0;
  }

  /**
   * Get all permissions for an object
   */
  async getObjectPermissions(
    objectType: ObjectType,
    objectId: string
  ): Promise<ObjectPermission[]> {
    const permRepo = this.dataSource.getRepository(ObjectPermission);

    return await permRepo.find({
      where: { objectType, objectId },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if user can view a private team
   */
  async canViewTeam(userId: string, teamId: string): Promise<boolean> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'baseRole'],
    });

    if (!user) {
      return false;
    }

    const team = await this.dataSource.getRepository(Team).findOne({
      where: { id: teamId },
      relations: ['memberships'],
    });

    if (!team) {
      return false;
    }

    return team.canUserView(userId, user.baseRole);
  }
}
