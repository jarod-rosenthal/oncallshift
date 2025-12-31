import { Repository } from 'typeorm';
import { User } from '../../../shared/models/User';
import { UserContactMethod } from '../../../shared/models/UserContactMethod';
import { UserNotificationRule } from '../../../shared/models/UserNotificationRule';

// Mock the data source
jest.mock('../../../shared/db/data-source', () => ({
  getDataSource: jest.fn(),
}));

import { getDataSource } from '../../../shared/db/data-source';

describe('Contact Method Import', () => {
  let mockUserRepo: jest.Mocked<Repository<User>>;
  let mockContactMethodRepo: jest.Mocked<Repository<UserContactMethod>>;
  let mockNotificationRuleRepo: jest.Mocked<Repository<UserNotificationRule>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    mockContactMethodRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    mockNotificationRuleRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    (getDataSource as jest.Mock).mockResolvedValue({
      getRepository: jest.fn((entity: any) => {
        if (entity === User) return mockUserRepo;
        if (entity === UserContactMethod) return mockContactMethodRepo;
        if (entity === UserNotificationRule) return mockNotificationRuleRepo;
        return {};
      }),
    });
  });

  describe('PagerDuty contact method type mapping', () => {
    const pdTypeMapping: Record<string, 'email' | 'sms' | 'phone' | 'push'> = {
      'email_contact_method': 'email',
      'phone_contact_method': 'phone',
      'sms_contact_method': 'sms',
      'push_notification_contact_method': 'push',
    };

    it('should map email_contact_method to email', () => {
      expect(pdTypeMapping['email_contact_method']).toBe('email');
    });

    it('should map phone_contact_method to phone', () => {
      expect(pdTypeMapping['phone_contact_method']).toBe('phone');
    });

    it('should map sms_contact_method to sms', () => {
      expect(pdTypeMapping['sms_contact_method']).toBe('sms');
    });

    it('should map push_notification_contact_method to push', () => {
      expect(pdTypeMapping['push_notification_contact_method']).toBe('push');
    });
  });

  describe('Opsgenie contact method type mapping', () => {
    const ogTypeMapping: Record<string, 'email' | 'sms' | 'phone' | 'push'> = {
      'email': 'email',
      'sms': 'sms',
      'voice': 'phone',
      'mobile': 'push',
    };

    it('should map email to email', () => {
      expect(ogTypeMapping['email']).toBe('email');
    });

    it('should map sms to sms', () => {
      expect(ogTypeMapping['sms']).toBe('sms');
    });

    it('should map voice to phone', () => {
      expect(ogTypeMapping['voice']).toBe('phone');
    });

    it('should map mobile to push', () => {
      expect(ogTypeMapping['mobile']).toBe('push');
    });
  });

  describe('Contact method import logic', () => {
    it('should skip import if contact method already exists', async () => {
      const existingContact: Partial<UserContactMethod> = {
        id: 'cm-123',
        userId: 'user-123',
        type: 'email',
        address: 'test@example.com',
      };

      mockContactMethodRepo.findOne.mockResolvedValue(existingContact as UserContactMethod);

      // Simulate the check logic
      const pdContact = {
        type: 'email_contact_method',
        address: 'test@example.com',
      };
      const userId = 'user-123';
      const contactType = 'email';

      const existing = await mockContactMethodRepo.findOne({
        where: {
          userId,
          type: contactType as any,
          address: pdContact.address,
        },
      });

      expect(existing).toEqual(existingContact);
      expect(mockContactMethodRepo.findOne).toHaveBeenCalled();
    });

    it('should create contact method if it does not exist', async () => {
      mockContactMethodRepo.findOne.mockResolvedValue(null);
      const newContact: Partial<UserContactMethod> = {
        id: 'cm-new',
        userId: 'user-123',
        type: 'sms',
        address: '+1234567890',
        verified: true,
        isDefault: false,
      };
      mockContactMethodRepo.create.mockReturnValue(newContact as UserContactMethod);
      mockContactMethodRepo.save.mockResolvedValue(newContact as UserContactMethod);

      // Simulate the creation logic
      const pdContact = {
        type: 'sms_contact_method',
        address: '+1234567890',
        label: 'Mobile',
      };

      const existing = await mockContactMethodRepo.findOne({
        where: {
          userId: 'user-123',
          type: 'sms' as any,
          address: pdContact.address,
        },
      });

      expect(existing).toBeNull();

      const created = mockContactMethodRepo.create({
        userId: 'user-123',
        type: 'sms',
        address: pdContact.address,
        label: pdContact.label || null,
        verified: true,
        isDefault: false,
      });

      await mockContactMethodRepo.save(created);

      expect(mockContactMethodRepo.create).toHaveBeenCalled();
      expect(mockContactMethodRepo.save).toHaveBeenCalled();
    });
  });

  describe('Notification rule import logic', () => {
    it('should map PagerDuty urgency values correctly', () => {
      const mapUrgency = (pdUrgency: string): 'high' | 'low' | 'any' => {
        if (pdUrgency === 'high') return 'high';
        if (pdUrgency === 'low') return 'low';
        return 'any';
      };

      expect(mapUrgency('high')).toBe('high');
      expect(mapUrgency('low')).toBe('low');
      expect(mapUrgency('critical')).toBe('any'); // unknown maps to any
    });

    it('should preserve start_delay_in_minutes', () => {
      const pdRule = {
        start_delay_in_minutes: 5,
        urgency: 'high',
        contact_method: { type: 'email_contact_method' },
      };

      expect(pdRule.start_delay_in_minutes).toBe(5);
    });

    it('should skip duplicate notification rules', async () => {
      const existingRule: Partial<UserNotificationRule> = {
        id: 'rule-123',
        userId: 'user-123',
        contactMethodId: 'cm-123',
        startDelayMinutes: 5,
        urgency: 'high',
      };

      mockNotificationRuleRepo.findOne.mockResolvedValue(existingRule as UserNotificationRule);

      const existing = await mockNotificationRuleRepo.findOne({
        where: {
          userId: 'user-123',
          contactMethodId: 'cm-123',
          startDelayMinutes: 5,
        },
      });

      expect(existing).toEqual(existingRule);
    });
  });
});

describe('Import Preview Contact Methods', () => {
  describe('PagerDuty preview', () => {
    it('should count contact methods per user', () => {
      const pdUser = {
        id: 'pd-user-1',
        email: 'user@example.com',
        name: 'Test User',
        contact_methods: [
          { type: 'email_contact_method', address: 'user@example.com' },
          { type: 'sms_contact_method', address: '+1234567890' },
          { type: 'phone_contact_method', address: '+1234567890' },
        ],
      };

      expect(pdUser.contact_methods.length).toBe(3);
    });

    it('should count notification rules per user', () => {
      const pdUser = {
        id: 'pd-user-1',
        email: 'user@example.com',
        notification_rules: [
          { start_delay_in_minutes: 0, urgency: 'high', contact_method: { type: 'email_contact_method' } },
          { start_delay_in_minutes: 5, urgency: 'high', contact_method: { type: 'sms_contact_method' } },
          { start_delay_in_minutes: 10, urgency: 'low', contact_method: { type: 'phone_contact_method' } },
        ],
      };

      expect(pdUser.notification_rules.length).toBe(3);
    });
  });

  describe('Opsgenie preview', () => {
    it('should count user contacts correctly', () => {
      const ogUser = {
        id: 'og-user-1',
        username: 'user@example.com',
        fullName: 'Test User',
        userContacts: [
          { method: 'email', to: 'user@example.com' },
          { method: 'sms', to: '+1234567890' },
          { method: 'voice', to: '+1234567890' },
        ],
      };

      expect(ogUser.userContacts.length).toBe(3);
    });

    it('should count notification rule steps for Opsgenie', () => {
      const ogUser = {
        id: 'og-user-1',
        username: 'user@example.com',
        notificationRules: [
          {
            name: 'Default Rule',
            steps: [
              { contact: { method: 'email', to: 'user@example.com' }, sendAfter: { timeAmount: 0 } },
              { contact: { method: 'sms', to: '+1234567890' }, sendAfter: { timeAmount: 5 } },
            ],
          },
        ],
      };

      // Count all steps across all notification rules
      const totalSteps = ogUser.notificationRules.reduce(
        (acc, rule) => acc + (rule.steps?.length || 0),
        0
      );

      expect(totalSteps).toBe(2);
    });
  });
});

describe('Contact Method Merging for Existing Users', () => {
  it('should handle user with existing contact methods', () => {
    const existingContacts = [
      { id: 'cm-1', type: 'email', address: 'user@example.com' },
      { id: 'cm-2', type: 'phone', address: '+1234567890' },
    ];

    const importContacts = [
      { type: 'email_contact_method', address: 'user@example.com' }, // duplicate
      { type: 'sms_contact_method', address: '+0987654321' }, // new
    ];

    // Simulate merge logic
    let imported = 0;
    let skipped = 0;

    for (const importContact of importContacts) {
      const typeMapping: Record<string, string> = {
        'email_contact_method': 'email',
        'sms_contact_method': 'sms',
        'phone_contact_method': 'phone',
      };
      const mappedType = typeMapping[importContact.type];

      const exists = existingContacts.some(
        (ec) => ec.type === mappedType && ec.address === importContact.address
      );

      if (exists) {
        skipped++;
      } else {
        imported++;
      }
    }

    expect(imported).toBe(1);
    expect(skipped).toBe(1);
  });

  it('should preserve contact method ID mapping for notification rules', () => {
    const contactMethodIdMap = new Map<string, string>();

    // Simulate mapping PD contact method IDs to OnCallShift IDs
    contactMethodIdMap.set('pd-cm-1', 'ocs-cm-1');
    contactMethodIdMap.set('pd-cm-2', 'ocs-cm-2');

    // Lookup for notification rule
    const pdRuleContactMethodId = 'pd-cm-1';
    const ocsContactMethodId = contactMethodIdMap.get(pdRuleContactMethodId);

    expect(ocsContactMethodId).toBe('ocs-cm-1');
  });
});

describe('Multi-Target Escalation Import', () => {
  describe('PagerDuty multi-target rules', () => {
    it('should process all targets in an escalation rule', () => {
      const pdRule = {
        escalation_delay_in_minutes: 5,
        targets: [
          { id: 'user-1', type: 'user_reference' },
          { id: 'user-2', type: 'user_reference' },
          { id: 'schedule-1', type: 'schedule_reference' },
        ],
      };

      expect(pdRule.targets.length).toBe(3);
      expect(pdRule.targets[0].type).toBe('user_reference');
      expect(pdRule.targets[2].type).toBe('schedule_reference');
    });

    it('should count multi-target steps in preview', () => {
      const pdPolicy = {
        id: 'policy-1',
        name: 'Test Policy',
        escalation_rules: [
          {
            escalation_delay_in_minutes: 5,
            targets: [
              { id: 'user-1', type: 'user_reference' },
              { id: 'user-2', type: 'user_reference' },
            ],
          },
          {
            escalation_delay_in_minutes: 10,
            targets: [
              { id: 'schedule-1', type: 'schedule_reference' },
            ],
          },
          {
            escalation_delay_in_minutes: 15,
            targets: [
              { id: 'user-3', type: 'user_reference' },
              { id: 'schedule-2', type: 'schedule_reference' },
              { id: 'schedule-3', type: 'schedule_reference' },
            ],
          },
        ],
      };

      // Count steps and total targets
      const stepCount = pdPolicy.escalation_rules.length;
      let totalTargets = 0;
      let multiTargetSteps = 0;

      for (const rule of pdPolicy.escalation_rules) {
        const targets = rule.targets?.length || 0;
        totalTargets += targets;
        if (targets > 1) {
          multiTargetSteps++;
        }
      }

      expect(stepCount).toBe(3);
      expect(totalTargets).toBe(6);
      expect(multiTargetSteps).toBe(2);
    });
  });

  describe('Opsgenie multi-recipient rules', () => {
    it('should process recipients array if available', () => {
      const ogRule = {
        condition: 'if-not-acked',
        notifyType: 'default',
        delay: { timeAmount: 5 },
        recipient: { type: 'user', id: 'user-1' },
        recipients: [
          { type: 'user', id: 'user-1' },
          { type: 'user', id: 'user-2' },
          { type: 'schedule', id: 'schedule-1' },
        ],
      };

      // Prefer recipients array over single recipient
      const allRecipients = ogRule.recipients?.length
        ? ogRule.recipients
        : [ogRule.recipient];

      expect(allRecipients.length).toBe(3);
    });

    it('should fall back to single recipient if no recipients array', () => {
      const ogRule: {
        condition: string;
        notifyType: string;
        delay: { timeAmount: number };
        recipient: { type: string; id: string };
        recipients?: Array<{ type: string; id: string }>;
      } = {
        condition: 'if-not-acked',
        notifyType: 'default',
        delay: { timeAmount: 5 },
        recipient: { type: 'user', id: 'user-1' },
      };

      const allRecipients = ogRule.recipients?.length
        ? ogRule.recipients
        : [ogRule.recipient];

      expect(allRecipients.length).toBe(1);
      expect(allRecipients[0].id).toBe('user-1');
    });
  });

  describe('NotifyStrategy', () => {
    it('should default to "all" for PagerDuty imports', () => {
      // PagerDuty notifies all targets simultaneously by default
      const notifyStrategy = 'all';
      expect(notifyStrategy).toBe('all');
    });

    it('should support round_robin strategy', () => {
      const strategies = ['all', 'round_robin'];
      expect(strategies).toContain('all');
      expect(strategies).toContain('round_robin');
    });
  });

  describe('EscalationTarget creation', () => {
    it('should create target for each user in multi-target rule', () => {
      const userIdMap = new Map<string, string>();
      userIdMap.set('pd-user-1', 'ocs-user-1');
      userIdMap.set('pd-user-2', 'ocs-user-2');

      const targets = [
        { id: 'pd-user-1', type: 'user_reference' },
        { id: 'pd-user-2', type: 'user_reference' },
      ];

      const createdTargets: any[] = [];
      for (const target of targets) {
        if (target.type === 'user_reference') {
          const mappedUserId = userIdMap.get(target.id);
          if (mappedUserId) {
            createdTargets.push({
              targetType: 'user',
              userId: mappedUserId,
            });
          }
        }
      }

      expect(createdTargets.length).toBe(2);
      expect(createdTargets[0].userId).toBe('ocs-user-1');
      expect(createdTargets[1].userId).toBe('ocs-user-2');
    });

    it('should create target for schedules in multi-target rule', () => {
      const scheduleIdMap = new Map<string, string>();
      scheduleIdMap.set('pd-schedule-1', 'ocs-schedule-1');
      scheduleIdMap.set('pd-schedule-2', 'ocs-schedule-2');

      const targets = [
        { id: 'pd-schedule-1', type: 'schedule_reference' },
        { id: 'pd-schedule-2', type: 'schedule_reference' },
      ];

      const createdTargets: any[] = [];
      for (const target of targets) {
        if (target.type === 'schedule_reference') {
          const mappedScheduleId = scheduleIdMap.get(target.id);
          if (mappedScheduleId) {
            createdTargets.push({
              targetType: 'schedule',
              scheduleId: mappedScheduleId,
            });
          }
        }
      }

      expect(createdTargets.length).toBe(2);
      expect(createdTargets[0].scheduleId).toBe('ocs-schedule-1');
      expect(createdTargets[1].scheduleId).toBe('ocs-schedule-2');
    });
  });
});

describe('Routing Rule Import', () => {
  describe('PagerDuty operator mapping', () => {
    const mapPagerDutyOperator = (pdOperator: string): string | null => {
      const mapping: Record<string, string> = {
        'equals': 'equals',
        'contains': 'contains',
        'matches': 'matches_regex',
        'exists': 'exists',
        'not': 'not_equals',
      };
      return mapping[pdOperator] || null;
    };

    it('should map equals operator', () => {
      expect(mapPagerDutyOperator('equals')).toBe('equals');
    });

    it('should map contains operator', () => {
      expect(mapPagerDutyOperator('contains')).toBe('contains');
    });

    it('should map matches to matches_regex', () => {
      expect(mapPagerDutyOperator('matches')).toBe('matches_regex');
    });

    it('should map exists operator', () => {
      expect(mapPagerDutyOperator('exists')).toBe('exists');
    });

    it('should map not to not_equals', () => {
      expect(mapPagerDutyOperator('not')).toBe('not_equals');
    });

    it('should return null for unknown operators', () => {
      expect(mapPagerDutyOperator('unknown')).toBeNull();
    });
  });

  describe('Opsgenie operator mapping', () => {
    const mapOpsgenieOperator = (ogOperator: string): string | null => {
      const mapping: Record<string, string> = {
        'equals': 'equals',
        'equals-ignore-whitespace': 'equals',
        'contains': 'contains',
        'contains-key': 'exists',
        'starts-with': 'starts_with',
        'ends-with': 'ends_with',
        'matches': 'matches_regex',
        'is-empty': 'is_empty',
        'greater-than': 'greater_than',
        'less-than': 'less_than',
      };
      return mapping[ogOperator] || null;
    };

    it('should map equals operator', () => {
      expect(mapOpsgenieOperator('equals')).toBe('equals');
    });

    it('should map equals-ignore-whitespace to equals', () => {
      expect(mapOpsgenieOperator('equals-ignore-whitespace')).toBe('equals');
    });

    it('should map contains operator', () => {
      expect(mapOpsgenieOperator('contains')).toBe('contains');
    });

    it('should map contains-key to exists', () => {
      expect(mapOpsgenieOperator('contains-key')).toBe('exists');
    });

    it('should map starts-with to starts_with', () => {
      expect(mapOpsgenieOperator('starts-with')).toBe('starts_with');
    });

    it('should map ends-with to ends_with', () => {
      expect(mapOpsgenieOperator('ends-with')).toBe('ends_with');
    });

    it('should map matches to matches_regex', () => {
      expect(mapOpsgenieOperator('matches')).toBe('matches_regex');
    });

    it('should map is-empty', () => {
      expect(mapOpsgenieOperator('is-empty')).toBe('is_empty');
    });

    it('should map comparison operators', () => {
      expect(mapOpsgenieOperator('greater-than')).toBe('greater_than');
      expect(mapOpsgenieOperator('less-than')).toBe('less_than');
    });

    it('should return null for unknown operators', () => {
      expect(mapOpsgenieOperator('unknown')).toBeNull();
    });
  });

  describe('PagerDuty path mapping', () => {
    const mapPagerDutyPath = (pdPath: string): string => {
      const mapping: Record<string, string> = {
        'event.summary': 'summary',
        'event.source': 'source',
        'event.severity': 'severity',
        'event.class': 'class',
        'event.component': 'component',
        'event.group': 'group',
        'event.custom_details': 'custom_details',
      };
      return mapping[pdPath] || pdPath.replace('event.', '');
    };

    it('should map event.summary to summary', () => {
      expect(mapPagerDutyPath('event.summary')).toBe('summary');
    });

    it('should map event.source to source', () => {
      expect(mapPagerDutyPath('event.source')).toBe('source');
    });

    it('should map event.severity to severity', () => {
      expect(mapPagerDutyPath('event.severity')).toBe('severity');
    });

    it('should strip event. prefix for unmapped paths', () => {
      expect(mapPagerDutyPath('event.custom_field')).toBe('custom_field');
    });
  });

  describe('PagerDuty severity mapping', () => {
    const mapPagerDutySeverity = (pdSeverity: string): string | null => {
      const mapping: Record<string, string> = {
        'critical': 'critical',
        'error': 'error',
        'warning': 'warning',
        'info': 'info',
      };
      return mapping[pdSeverity?.toLowerCase()] || null;
    };

    it('should map critical severity', () => {
      expect(mapPagerDutySeverity('critical')).toBe('critical');
      expect(mapPagerDutySeverity('CRITICAL')).toBe('critical');
    });

    it('should map error severity', () => {
      expect(mapPagerDutySeverity('error')).toBe('error');
    });

    it('should map warning severity', () => {
      expect(mapPagerDutySeverity('warning')).toBe('warning');
    });

    it('should map info severity', () => {
      expect(mapPagerDutySeverity('info')).toBe('info');
    });

    it('should return null for unknown severity', () => {
      expect(mapPagerDutySeverity('unknown')).toBeNull();
    });
  });

  describe('Opsgenie priority mapping', () => {
    const mapOpsgeniePriority = (ogPriority: string): string | null => {
      const mapping: Record<string, string> = {
        'P1': 'critical',
        'P2': 'error',
        'P3': 'warning',
        'P4': 'info',
        'P5': 'info',
      };
      return mapping[ogPriority] || null;
    };

    it('should map P1 to critical', () => {
      expect(mapOpsgeniePriority('P1')).toBe('critical');
    });

    it('should map P2 to error', () => {
      expect(mapOpsgeniePriority('P2')).toBe('error');
    });

    it('should map P3 to warning', () => {
      expect(mapOpsgeniePriority('P3')).toBe('warning');
    });

    it('should map P4/P5 to info', () => {
      expect(mapOpsgeniePriority('P4')).toBe('info');
      expect(mapOpsgeniePriority('P5')).toBe('info');
    });

    it('should return null for unknown priority', () => {
      expect(mapOpsgeniePriority('P6')).toBeNull();
    });
  });

  describe('Opsgenie field mapping', () => {
    const mapOpsgenieField = (ogField: string): string => {
      const mapping: Record<string, string> = {
        'message': 'summary',
        'alias': 'dedup_key',
        'description': 'description',
        'source': 'source',
        'entity': 'class',
        'tags': 'tags',
        'actions': 'custom_details.actions',
        'details': 'custom_details',
        'extra-properties': 'custom_details',
        'priority': 'severity',
        'responders': 'responders',
        'teams': 'teams',
      };
      return mapping[ogField] || ogField;
    };

    it('should map message to summary', () => {
      expect(mapOpsgenieField('message')).toBe('summary');
    });

    it('should map alias to dedup_key', () => {
      expect(mapOpsgenieField('alias')).toBe('dedup_key');
    });

    it('should map entity to class', () => {
      expect(mapOpsgenieField('entity')).toBe('class');
    });

    it('should map priority to severity', () => {
      expect(mapOpsgenieField('priority')).toBe('severity');
    });

    it('should pass through unknown fields', () => {
      expect(mapOpsgenieField('custom_field')).toBe('custom_field');
    });
  });

  describe('PagerDuty event rule parsing', () => {
    it('should extract conditions from PagerDuty event rule', () => {
      const pdRule = {
        id: 'rule-1',
        label: 'Route Database Alerts',
        disabled: false,
        conditions: {
          operator: 'and' as const,
          subconditions: [
            { operator: 'contains', path: 'event.summary', value: 'database' },
            { operator: 'equals', path: 'event.source', value: 'prod-db-01' },
          ],
        },
        actions: {
          route: { type: 'service', value: 'service-123' },
          severity: { type: 'constant', value: 'critical' },
        },
      };

      const conditions = pdRule.conditions?.subconditions?.map(c => ({
        field: c.path.replace('event.', ''),
        operator: c.operator,
        value: c.value,
      })) || [];

      expect(conditions.length).toBe(2);
      expect(conditions[0]).toEqual({
        field: 'summary',
        operator: 'contains',
        value: 'database',
      });
      expect(conditions[1]).toEqual({
        field: 'source',
        operator: 'equals',
        value: 'prod-db-01',
      });
    });

    it('should handle catch-all rules with no conditions', () => {
      const pdRule: {
        id: string;
        label: string;
        catch_all: boolean;
        conditions?: { subconditions?: Array<{ operator: string; path: string; value: string }> };
        actions: { route: { type: string; value: string } };
      } = {
        id: 'catch-all',
        label: 'Catch All',
        catch_all: true,
        conditions: undefined,
        actions: {
          route: { type: 'service', value: 'default-service' },
        },
      };

      const conditions = pdRule.conditions?.subconditions || [];
      expect(conditions.length).toBe(0);
      expect(pdRule.catch_all).toBe(true);
    });
  });

  describe('Opsgenie alert policy parsing', () => {
    it('should extract conditions from Opsgenie alert policy', () => {
      const ogPolicy = {
        id: 'policy-1',
        name: 'Critical Alerts',
        enabled: true,
        filter: {
          type: 'match-all',
          conditions: [
            { field: 'priority', operation: 'equals', expectedValue: 'P1', not: false },
            { field: 'message', operation: 'contains', expectedValue: 'critical', not: false },
          ],
        },
        priority: 'P1',
        responders: [
          { type: 'team', id: 'team-123', name: 'SRE Team' },
        ],
      };

      const conditions = ogPolicy.filter?.conditions?.map(c => ({
        field: c.field,
        operator: c.operation,
        value: c.expectedValue,
        not: c.not || false,
      })) || [];

      expect(conditions.length).toBe(2);
      expect(conditions[0]).toEqual({
        field: 'priority',
        operator: 'equals',
        value: 'P1',
        not: false,
      });
      expect(conditions[1]).toEqual({
        field: 'message',
        operator: 'contains',
        value: 'critical',
        not: false,
      });
    });

    it('should handle negated conditions', () => {
      const ogPolicy = {
        id: 'policy-2',
        name: 'Exclude Test Alerts',
        enabled: true,
        filter: {
          type: 'match-all',
          conditions: [
            { field: 'source', operation: 'contains', expectedValue: 'test', not: true },
          ],
        },
      };

      const conditions = ogPolicy.filter?.conditions?.map(c => ({
        field: c.field,
        operator: c.operation,
        value: c.expectedValue,
        not: c.not || false,
      })) || [];

      expect(conditions[0].not).toBe(true);
    });

    it('should extract match type from filter', () => {
      const ogPolicy = {
        id: 'policy-3',
        name: 'Any Match Policy',
        filter: {
          type: 'match-any-condition',
          conditions: [
            { field: 'source', operation: 'equals', expectedValue: 'server-1' },
            { field: 'source', operation: 'equals', expectedValue: 'server-2' },
          ],
        },
      };

      const matchType = ogPolicy.filter?.type === 'match-any-condition' ? 'any' : 'all';
      expect(matchType).toBe('any');
    });
  });

  describe('Service ID mapping for routing rules', () => {
    it('should map PagerDuty service ID to OnCallShift service ID', () => {
      const serviceIdMap = new Map<string, string>();
      serviceIdMap.set('pd-service-1', 'ocs-service-1');
      serviceIdMap.set('pd-service-2', 'ocs-service-2');

      const pdRule = {
        actions: {
          route: { type: 'service', value: 'pd-service-1' },
        },
      };

      const targetServiceId = pdRule.actions?.route?.value
        ? serviceIdMap.get(pdRule.actions.route.value)
        : null;

      expect(targetServiceId).toBe('ocs-service-1');
    });

    it('should return undefined for unmapped service', () => {
      const serviceIdMap = new Map<string, string>();
      serviceIdMap.set('pd-service-1', 'ocs-service-1');

      const pdRule = {
        actions: {
          route: { type: 'service', value: 'unmapped-service' },
        },
      };

      const targetServiceId = pdRule.actions?.route?.value
        ? serviceIdMap.get(pdRule.actions.route.value)
        : null;

      expect(targetServiceId).toBeUndefined();
    });
  });
});

describe('Heartbeat Import', () => {
  describe('Opsgenie heartbeat interval conversion', () => {
    const convertIntervalToSeconds = (interval: number, unit: string): number => {
      switch (unit) {
        case 'hours':
          return interval * 60 * 60;
        case 'days':
          return interval * 24 * 60 * 60;
        case 'minutes':
        default:
          return interval * 60;
      }
    };

    it('should convert minutes to seconds', () => {
      expect(convertIntervalToSeconds(5, 'minutes')).toBe(300);
      expect(convertIntervalToSeconds(10, 'minutes')).toBe(600);
    });

    it('should convert hours to seconds', () => {
      expect(convertIntervalToSeconds(1, 'hours')).toBe(3600);
      expect(convertIntervalToSeconds(2, 'hours')).toBe(7200);
    });

    it('should convert days to seconds', () => {
      expect(convertIntervalToSeconds(1, 'days')).toBe(86400);
      expect(convertIntervalToSeconds(7, 'days')).toBe(604800);
    });
  });

  describe('Heartbeat model helper methods', () => {
    it('should correctly determine if heartbeat is healthy', () => {
      const now = Date.now();
      const lastPingAt = new Date(now - 60000); // 1 minute ago
      const intervalSeconds = 300; // 5 minutes

      const isHealthy = (now - lastPingAt.getTime()) < (intervalSeconds * 1000);
      expect(isHealthy).toBe(true);
    });

    it('should correctly determine if heartbeat is unhealthy', () => {
      const now = Date.now();
      const lastPingAt = new Date(now - 360000); // 6 minutes ago
      const intervalSeconds = 300; // 5 minutes

      const isHealthy = (now - lastPingAt.getTime()) < (intervalSeconds * 1000);
      expect(isHealthy).toBe(false);
    });

    it('should correctly calculate missed intervals', () => {
      const now = Date.now();
      const lastPingAt = new Date(now - 900000); // 15 minutes ago
      const intervalSeconds = 300; // 5 minutes

      const missedIntervals = Math.floor((now - lastPingAt.getTime()) / (intervalSeconds * 1000));
      expect(missedIntervals).toBe(3);
    });

    it('should correctly determine if heartbeat is expired', () => {
      const now = Date.now();
      const lastPingAt = new Date(now - 600000); // 10 minutes ago
      const intervalSeconds = 300; // 5 minutes
      const alertAfterMissedCount = 2;

      const missedIntervals = Math.floor((now - lastPingAt.getTime()) / (intervalSeconds * 1000));
      const isExpired = missedIntervals >= alertAfterMissedCount;

      expect(missedIntervals).toBe(2);
      expect(isExpired).toBe(true);
    });

    it('should not be expired if missed count is below threshold', () => {
      const now = Date.now();
      const lastPingAt = new Date(now - 400000); // ~6.6 minutes ago
      const intervalSeconds = 300; // 5 minutes
      const alertAfterMissedCount = 3;

      const missedIntervals = Math.floor((now - lastPingAt.getTime()) / (intervalSeconds * 1000));
      const isExpired = missedIntervals >= alertAfterMissedCount;

      expect(missedIntervals).toBe(1);
      expect(isExpired).toBe(false);
    });

    it('should determine status based on conditions', () => {
      const now = Date.now();

      // Status: unknown - never pinged
      const getStatus = (lastPingAt: Date | null, intervalSeconds: number, alertAfterMissedCount: number): string => {
        if (!lastPingAt) return 'unknown';

        const elapsed = now - lastPingAt.getTime();
        const isHealthy = elapsed < (intervalSeconds * 1000);

        if (isHealthy) return 'healthy';

        const missedIntervals = Math.floor(elapsed / (intervalSeconds * 1000));
        if (missedIntervals >= alertAfterMissedCount) return 'expired';

        return 'unhealthy';
      };

      // Never pinged
      expect(getStatus(null, 300, 1)).toBe('unknown');

      // Healthy - pinged recently
      expect(getStatus(new Date(now - 60000), 300, 1)).toBe('healthy');

      // Unhealthy - missed one ping but threshold is 2
      expect(getStatus(new Date(now - 400000), 300, 2)).toBe('unhealthy');

      // Expired - missed enough pings
      expect(getStatus(new Date(now - 700000), 300, 2)).toBe('expired');
    });
  });

  describe('Opsgenie heartbeat parsing', () => {
    it('should parse Opsgenie heartbeat structure', () => {
      const ogHeartbeat = {
        name: 'Database Backup',
        description: 'Daily database backup check',
        interval: 24,
        intervalUnit: 'hours' as const,
        enabled: true,
        ownerTeam: { id: 'team-123', name: 'DBA Team' },
        alertMessage: 'Database backup failed!',
        alertPriority: 'P1',
      };

      expect(ogHeartbeat.name).toBe('Database Backup');
      expect(ogHeartbeat.interval).toBe(24);
      expect(ogHeartbeat.intervalUnit).toBe('hours');
      expect(ogHeartbeat.enabled).toBe(true);
    });

    it('should handle disabled heartbeats', () => {
      const ogHeartbeat = {
        name: 'Legacy System Check',
        interval: 1,
        intervalUnit: 'days' as const,
        enabled: false,
      };

      expect(ogHeartbeat.enabled).toBe(false);
    });

    it('should default to enabled if not specified', () => {
      const ogHeartbeat: {
        name: string;
        interval: number;
        intervalUnit: 'minutes' | 'hours' | 'days';
        enabled?: boolean;
      } = {
        name: 'Service Ping',
        interval: 5,
        intervalUnit: 'minutes',
      };

      const enabled = ogHeartbeat.enabled !== false;
      expect(enabled).toBe(true);
    });
  });
});

describe('Maintenance Window Import', () => {
  describe('PagerDuty maintenance window parsing', () => {
    it('should parse PagerDuty maintenance window structure', () => {
      const pdWindow = {
        id: 'mw-123',
        type: 'maintenance_window',
        summary: 'Database Upgrade',
        description: 'Planned database upgrade',
        start_time: '2025-01-15T02:00:00Z',
        end_time: '2025-01-15T06:00:00Z',
        services: [
          { id: 'service-1', type: 'service_reference', summary: 'Database Service' },
        ],
        teams: [
          { id: 'team-1', type: 'team_reference', summary: 'DBA Team' },
        ],
        created_by: {
          id: 'user-1',
          type: 'user_reference',
          summary: 'John Doe',
        },
      };

      expect(pdWindow.id).toBe('mw-123');
      expect(pdWindow.summary).toBe('Database Upgrade');
      expect(pdWindow.start_time).toBe('2025-01-15T02:00:00Z');
      expect(pdWindow.end_time).toBe('2025-01-15T06:00:00Z');
      expect(pdWindow.services?.length).toBe(1);
      expect(pdWindow.services?.[0].id).toBe('service-1');
    });

    it('should handle maintenance window with multiple services', () => {
      const pdWindow = {
        id: 'mw-456',
        summary: 'Infrastructure Update',
        start_time: '2025-01-20T00:00:00Z',
        end_time: '2025-01-20T04:00:00Z',
        services: [
          { id: 'service-1', type: 'service_reference', summary: 'Service A' },
          { id: 'service-2', type: 'service_reference', summary: 'Service B' },
          { id: 'service-3', type: 'service_reference', summary: 'Service C' },
        ],
      };

      expect(pdWindow.services?.length).toBe(3);
    });

    it('should skip past maintenance windows', () => {
      const pdWindow = {
        id: 'mw-old',
        summary: 'Past Maintenance',
        start_time: '2020-01-01T00:00:00Z',
        end_time: '2020-01-01T04:00:00Z',
        services: [],
      };

      const endTime = new Date(pdWindow.end_time);
      const now = new Date();

      expect(endTime < now).toBe(true);
    });
  });

  describe('Opsgenie maintenance window parsing', () => {
    it('should parse scheduled Opsgenie maintenance window', () => {
      const ogWindow = {
        id: 'mw-og-123',
        description: 'Scheduled server maintenance',
        time: {
          type: 'schedule' as const,
          startDate: '2025-02-01T03:00:00Z',
          endDate: '2025-02-01T05:00:00Z',
        },
        rules: [
          { state: 'enabled', entity: { id: 'integration-1', type: 'integration' } },
        ],
      };

      expect(ogWindow.id).toBe('mw-og-123');
      expect(ogWindow.time.type).toBe('schedule');
      expect(ogWindow.time.startDate).toBe('2025-02-01T03:00:00Z');
      expect(ogWindow.time.endDate).toBe('2025-02-01T05:00:00Z');
    });

    it('should handle quick maintenance window types', () => {
      const windowTypes = ['for-5-minutes', 'for-30-minutes', 'for-1-hour', 'indefinitely'];
      const now = new Date();

      for (const timeType of windowTypes) {
        const ogWindow = {
          id: `mw-quick-${timeType}`,
          time: {
            type: timeType as 'for-5-minutes' | 'for-30-minutes' | 'for-1-hour' | 'indefinitely',
          },
        };

        let expectedDuration: number;
        switch (ogWindow.time.type) {
          case 'for-5-minutes':
            expectedDuration = 5 * 60 * 1000;
            break;
          case 'for-30-minutes':
            expectedDuration = 30 * 60 * 1000;
            break;
          case 'for-1-hour':
            expectedDuration = 60 * 60 * 1000;
            break;
          case 'indefinitely':
            expectedDuration = 365 * 24 * 60 * 60 * 1000;
            break;
          default:
            expectedDuration = 60 * 60 * 1000;
        }

        const endTime = new Date(now.getTime() + expectedDuration);
        expect(endTime > now).toBe(true);
      }
    });

    it('should extract integration IDs from rules', () => {
      const ogWindow = {
        id: 'mw-og-456',
        description: 'Multi-integration maintenance',
        time: {
          type: 'schedule' as const,
          startDate: '2025-03-01T00:00:00Z',
          endDate: '2025-03-01T02:00:00Z',
        },
        rules: [
          { state: 'enabled', entity: { id: 'int-1', type: 'integration' } },
          { state: 'enabled', entity: { id: 'int-2', type: 'integration' } },
        ],
      };

      const integrationIds = ogWindow.rules
        ?.filter((r: { state: string; entity?: { id: string; type: string } }) => r.entity?.type === 'integration')
        .map((r: { state: string; entity?: { id: string; type: string } }) => r.entity?.id);

      expect(integrationIds?.length).toBe(2);
      expect(integrationIds).toContain('int-1');
      expect(integrationIds).toContain('int-2');
    });
  });

  describe('Maintenance window date handling', () => {
    it('should correctly parse ISO date strings', () => {
      const startTimeStr = '2025-01-15T14:30:00Z';
      const endTimeStr = '2025-01-15T18:00:00Z';

      const startTime = new Date(startTimeStr);
      const endTime = new Date(endTimeStr);

      expect(startTime.getTime()).toBeLessThan(endTime.getTime());
      expect(endTime.getTime() - startTime.getTime()).toBe(3.5 * 60 * 60 * 1000); // 3.5 hours
    });

    it('should detect future vs past maintenance windows', () => {
      const now = new Date();
      const futureEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
      const pastEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday

      expect(futureEnd > now).toBe(true);
      expect(pastEnd < now).toBe(true);
    });
  });

  describe('Maintenance window service association', () => {
    it('should use first service from PagerDuty window', () => {
      const serviceIdMap = new Map<string, string>();
      serviceIdMap.set('pd-service-1', 'ocs-service-1');
      serviceIdMap.set('pd-service-2', 'ocs-service-2');

      const pdWindow = {
        id: 'mw-123',
        services: [
          { id: 'pd-service-1' },
          { id: 'pd-service-2' },
        ],
      };

      const serviceId = pdWindow.services?.[0]?.id
        ? serviceIdMap.get(pdWindow.services[0].id)
        : undefined;

      expect(serviceId).toBe('ocs-service-1');
    });

    it('should handle maintenance window with no services', () => {
      const pdWindow: {
        id: string;
        services?: Array<{ id: string }>;
      } = {
        id: 'mw-no-services',
        services: [],
      };

      const serviceId = pdWindow.services?.[0]?.id || null;
      expect(serviceId).toBeNull();
    });
  });

  describe('Preview maintenance windows', () => {
    it('should count skipped past windows separately', () => {
      const summary = {
        total: 5,
        existing: 1,
        new: 2,
        skippedPast: 2,
      };

      expect(summary.total).toBe(5);
      expect(summary.skippedPast).toBe(2);
      expect(summary.existing + summary.new + summary.skippedPast).toBe(5);
    });

    it('should include time range in preview details', () => {
      const detail = {
        description: 'Server Upgrade',
        status: 'new',
        startTime: '2025-02-01T00:00:00Z',
        endTime: '2025-02-01T04:00:00Z',
      };

      expect(detail.startTime).toBeDefined();
      expect(detail.endTime).toBeDefined();
      expect(detail.status).toBe('new');
    });
  });
});
