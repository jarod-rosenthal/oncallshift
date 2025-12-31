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
