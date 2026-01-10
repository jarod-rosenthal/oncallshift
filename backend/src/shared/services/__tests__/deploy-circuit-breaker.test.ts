import { DeployCircuitBreaker } from '../deploy-circuit-breaker';
import { AIWorkerTask } from '../../models/AIWorkerTask';
import { Repository } from 'typeorm';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DeployCircuitBreaker', () => {
  let circuitBreaker: DeployCircuitBreaker;
  let mockTaskRepo: jest.Mocked<Repository<AIWorkerTask>>;

  beforeEach(() => {
    // Create mock repository
    mockTaskRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    circuitBreaker = new DeployCircuitBreaker(mockTaskRepo);
  });

  describe('canAttemptDeploy', () => {
    it('should return true if retry count is below max', async () => {
      const mockTask = {
        id: 'task-1',
        jiraIssueKey: 'OCS-123',
        deployRetryCount: 1,
        maxDeployRetries: 5,
      } as AIWorkerTask;

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const result = await circuitBreaker.canAttemptDeploy('task-1');
      expect(result).toBe(true);
    });

    it('should return false if retry count equals max', async () => {
      const mockTask = {
        id: 'task-1',
        jiraIssueKey: 'OCS-123',
        deployRetryCount: 5,
        maxDeployRetries: 5,
      } as AIWorkerTask;

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const result = await circuitBreaker.canAttemptDeploy('task-1');
      expect(result).toBe(false);
    });

    it('should throw error if task not found', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);

      await expect(circuitBreaker.canAttemptDeploy('task-1')).rejects.toThrow(
        'Task not found: task-1'
      );
    });
  });

  describe('recordAttempt', () => {
    it('should increment retry count and update timestamp', async () => {
      const mockTask = {
        id: 'task-1',
        jiraIssueKey: 'OCS-123',
        deployRetryCount: 1,
        maxDeployRetries: 5,
        lastDeploymentAt: null,
      } as AIWorkerTask;

      mockTaskRepo.findOne.mockResolvedValue(mockTask);
      mockTaskRepo.save.mockResolvedValue(mockTask);

      await circuitBreaker.recordAttempt('task-1');

      expect(mockTask.deployRetryCount).toBe(2);
      expect(mockTask.lastDeploymentAt).toBeInstanceOf(Date);
      expect(mockTaskRepo.save).toHaveBeenCalledWith(mockTask);
    });
  });

  describe('reset', () => {
    it('should reset retry counters', async () => {
      const mockTask = {
        id: 'task-1',
        jiraIssueKey: 'OCS-123',
        deployRetryCount: 3,
        maxDeployRetries: 5,
        lastDeploymentAt: new Date(),
      } as AIWorkerTask;

      mockTaskRepo.findOne.mockResolvedValue(mockTask);
      mockTaskRepo.save.mockResolvedValue(mockTask);

      await circuitBreaker.reset('task-1');

      expect(mockTask.deployRetryCount).toBe(0);
      expect(mockTask.lastDeploymentAt).toBeNull();
      expect(mockTaskRepo.save).toHaveBeenCalledWith(mockTask);
    });
  });

  describe('isWithinRateLimit', () => {
    it('should return true if no previous deployment', async () => {
      const mockTask = {
        id: 'task-1',
        jiraIssueKey: 'OCS-123',
        lastDeploymentAt: null,
      } as AIWorkerTask;

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const result = await circuitBreaker.isWithinRateLimit('task-1', 5);
      expect(result).toBe(true);
    });

    it('should return true if enough time has passed', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const mockTask = {
        id: 'task-1',
        jiraIssueKey: 'OCS-123',
        lastDeploymentAt: tenMinutesAgo,
      } as AIWorkerTask;

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const result = await circuitBreaker.isWithinRateLimit('task-1', 5);
      expect(result).toBe(true);
    });

    it('should return false if not enough time has passed', async () => {
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
      const mockTask = {
        id: 'task-1',
        jiraIssueKey: 'OCS-123',
        lastDeploymentAt: oneMinuteAgo,
      } as AIWorkerTask;

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const result = await circuitBreaker.isWithinRateLimit('task-1', 5);
      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return correct status information', async () => {
      const mockTask = {
        id: 'task-1',
        jiraIssueKey: 'OCS-123',
        deployRetryCount: 2,
        maxDeployRetries: 5,
        lastDeploymentAt: new Date(),
      } as AIWorkerTask;

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const status = await circuitBreaker.getStatus('task-1');

      expect(status.canAttempt).toBe(true);
      expect(status.deployRetryCount).toBe(2);
      expect(status.maxDeployRetries).toBe(5);
      expect(status.remainingRetries).toBe(3);
      expect(status.isCircuitOpen).toBe(false);
    });

    it('should indicate circuit is open when max retries reached', async () => {
      const mockTask = {
        id: 'task-1',
        jiraIssueKey: 'OCS-123',
        deployRetryCount: 5,
        maxDeployRetries: 5,
        lastDeploymentAt: new Date(),
      } as AIWorkerTask;

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const status = await circuitBreaker.getStatus('task-1');

      expect(status.canAttempt).toBe(false);
      expect(status.remainingRetries).toBe(0);
      expect(status.isCircuitOpen).toBe(true);
    });
  });

  describe('forceOpen', () => {
    it('should set retry count to max', async () => {
      const mockTask = {
        id: 'task-1',
        jiraIssueKey: 'OCS-123',
        deployRetryCount: 2,
        maxDeployRetries: 5,
      } as AIWorkerTask;

      mockTaskRepo.findOne.mockResolvedValue(mockTask);
      mockTaskRepo.save.mockResolvedValue(mockTask);

      await circuitBreaker.forceOpen('task-1', 'Safety concern');

      expect(mockTask.deployRetryCount).toBe(5);
      expect(mockTaskRepo.save).toHaveBeenCalledWith(mockTask);
    });
  });
});
