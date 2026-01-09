import { logger } from '../utils/logger';

// GitHub API types
interface GitHubRef {
  ref: string;
  object: { sha: string; type: string };
}

interface GitHubPullRequest {
  number: number;
  html_url: string;
  state: string;
  title: string;
  body: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  mergeable: boolean | null;
  merged: boolean;
  additions: number;
  deletions: number;
  changed_files: number;
}

interface GitHubCheckRun {
  id: number;
  name: string;
  status: string;  // 'queued', 'in_progress', 'completed'
  conclusion: string | null;  // 'success', 'failure', 'neutral', etc.
}

interface GitHubReview {
  id: number;
  user: { login: string };
  state: string;  // 'APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'PENDING'
  body: string;
}

interface CreatePROptions {
  title: string;
  body: string;
  head: string;   // Source branch
  base?: string;  // Target branch (default: main)
  draft?: boolean;
}

interface GitHubConfig {
  token: string;
  owner?: string;  // Default owner for repos
}

export class GitHubService {
  private token: string;
  private defaultOwner: string;
  private baseUrl = 'https://api.github.com';

  constructor(config: GitHubConfig) {
    this.token = config.token;
    this.defaultOwner = config.owner || '';
  }

  // ==================== API Helpers ====================

  private async request<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('GitHub API error', { status: response.status, error, endpoint });
      throw new Error(`GitHub API error ${response.status}: ${error}`);
    }

    // Some endpoints return empty body (204)
    if (response.status === 204) {
      return null as T;
    }

    return response.json() as Promise<T>;
  }

  private parseRepo(repo: string): { owner: string; repo: string } {
    if (repo.includes('/')) {
      const [owner, repoName] = repo.split('/');
      return { owner, repo: repoName };
    }
    return { owner: this.defaultOwner, repo };
  }

  // ==================== Branch Operations ====================

  async getDefaultBranch(repo: string): Promise<string> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const response = await this.request<{ default_branch: string }>(
      'GET',
      `/repos/${owner}/${repoName}`
    );
    return response.default_branch;
  }

  async getBranch(repo: string, branch: string): Promise<GitHubRef | null> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    try {
      return await this.request<GitHubRef>(
        'GET',
        `/repos/${owner}/${repoName}/git/ref/heads/${branch}`
      );
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async createBranch(repo: string, branchName: string, fromBranch?: string): Promise<GitHubRef> {
    const { owner, repo: repoName } = this.parseRepo(repo);

    // Get the SHA of the source branch
    const sourceBranch = fromBranch || await this.getDefaultBranch(repo);
    const sourceRef = await this.request<GitHubRef>(
      'GET',
      `/repos/${owner}/${repoName}/git/ref/heads/${sourceBranch}`
    );

    // Create the new branch
    const newRef = await this.request<GitHubRef>(
      'POST',
      `/repos/${owner}/${repoName}/git/refs`,
      {
        ref: `refs/heads/${branchName}`,
        sha: sourceRef.object.sha,
      }
    );

    logger.info('Created GitHub branch', { repo, branchName, sha: newRef.object.sha });
    return newRef;
  }

  async deleteBranch(repo: string, branchName: string): Promise<void> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    await this.request<null>(
      'DELETE',
      `/repos/${owner}/${repoName}/git/refs/heads/${branchName}`
    );
    logger.info('Deleted GitHub branch', { repo, branchName });
  }

  // ==================== Pull Request Operations ====================

  async createPullRequest(repo: string, options: CreatePROptions): Promise<GitHubPullRequest> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const base = options.base || await this.getDefaultBranch(repo);

    const pr = await this.request<GitHubPullRequest>(
      'POST',
      `/repos/${owner}/${repoName}/pulls`,
      {
        title: options.title,
        body: options.body,
        head: options.head,
        base,
        draft: options.draft || false,
      }
    );

    logger.info('Created GitHub PR', {
      repo,
      prNumber: pr.number,
      url: pr.html_url,
    });

    return pr;
  }

  async getPullRequest(repo: string, prNumber: number): Promise<GitHubPullRequest> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    return this.request<GitHubPullRequest>(
      'GET',
      `/repos/${owner}/${repoName}/pulls/${prNumber}`
    );
  }

  async updatePullRequest(
    repo: string,
    prNumber: number,
    updates: { title?: string; body?: string; state?: 'open' | 'closed' }
  ): Promise<GitHubPullRequest> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    return this.request<GitHubPullRequest>(
      'PATCH',
      `/repos/${owner}/${repoName}/pulls/${prNumber}`,
      updates
    );
  }

  async mergePullRequest(
    repo: string,
    prNumber: number,
    options?: {
      commitTitle?: string;
      commitMessage?: string;
      mergeMethod?: 'merge' | 'squash' | 'rebase';
    }
  ): Promise<{ sha: string; merged: boolean }> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    return this.request<{ sha: string; merged: boolean }>(
      'PUT',
      `/repos/${owner}/${repoName}/pulls/${prNumber}/merge`,
      {
        commit_title: options?.commitTitle,
        commit_message: options?.commitMessage,
        merge_method: options?.mergeMethod || 'squash',
      }
    );
  }

  async addPRLabels(repo: string, prNumber: number, labels: string[]): Promise<void> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    await this.request<any>(
      'POST',
      `/repos/${owner}/${repoName}/issues/${prNumber}/labels`,
      { labels }
    );
    logger.info('Added PR labels', { repo, prNumber, labels });
  }

  async addPRReviewers(
    repo: string,
    prNumber: number,
    reviewers: string[]
  ): Promise<void> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    await this.request<any>(
      'POST',
      `/repos/${owner}/${repoName}/pulls/${prNumber}/requested_reviewers`,
      { reviewers }
    );
    logger.info('Added PR reviewers', { repo, prNumber, reviewers });
  }

  // ==================== PR Status ====================

  async getPRChecks(repo: string, prNumber: number): Promise<{
    status: 'pending' | 'success' | 'failure';
    checks: GitHubCheckRun[];
  }> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const pr = await this.getPullRequest(repo, prNumber);

    const response = await this.request<{ check_runs: GitHubCheckRun[] }>(
      'GET',
      `/repos/${owner}/${repoName}/commits/${pr.head.sha}/check-runs`
    );

    const checks = response.check_runs;
    let status: 'pending' | 'success' | 'failure' = 'success';

    for (const check of checks) {
      if (check.status !== 'completed') {
        status = 'pending';
        break;
      }
      if (check.conclusion !== 'success' && check.conclusion !== 'neutral' && check.conclusion !== 'skipped') {
        status = 'failure';
        break;
      }
    }

    return { status, checks };
  }

  async getPRReviews(repo: string, prNumber: number): Promise<GitHubReview[]> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    return this.request<GitHubReview[]>(
      'GET',
      `/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`
    );
  }

  async getPRStatus(repo: string, prNumber: number): Promise<{
    pr: GitHubPullRequest;
    checksStatus: 'pending' | 'success' | 'failure';
    reviewStatus: 'pending' | 'approved' | 'changes_requested';
    canMerge: boolean;
  }> {
    const pr = await this.getPullRequest(repo, prNumber);
    const { status: checksStatus } = await this.getPRChecks(repo, prNumber);
    const reviews = await this.getPRReviews(repo, prNumber);

    // Determine review status
    let reviewStatus: 'pending' | 'approved' | 'changes_requested' = 'pending';
    const latestReviews = new Map<string, string>();

    for (const review of reviews) {
      if (review.state !== 'COMMENTED' && review.state !== 'PENDING') {
        latestReviews.set(review.user.login, review.state);
      }
    }

    if ([...latestReviews.values()].some(s => s === 'CHANGES_REQUESTED')) {
      reviewStatus = 'changes_requested';
    } else if ([...latestReviews.values()].some(s => s === 'APPROVED')) {
      reviewStatus = 'approved';
    }

    const canMerge =
      !pr.merged &&
      pr.mergeable === true &&
      checksStatus === 'success' &&
      reviewStatus === 'approved';

    return { pr, checksStatus, reviewStatus, canMerge };
  }

  // ==================== PR Reviews ====================

  /**
   * Submit a PR review (approve, request changes, or comment)
   */
  async submitPRReview(
    repo: string,
    prNumber: number,
    options: {
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
      body: string;
    }
  ): Promise<GitHubReview> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const review = await this.request<GitHubReview>(
      'POST',
      `/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`,
      {
        event: options.event,
        body: options.body,
      }
    );
    logger.info('Submitted PR review', {
      repo,
      prNumber,
      event: options.event,
      reviewId: review.id,
    });
    return review;
  }

  /**
   * Approve a PR with an optional comment
   */
  async approvePR(repo: string, prNumber: number, comment?: string): Promise<GitHubReview> {
    return this.submitPRReview(repo, prNumber, {
      event: 'APPROVE',
      body: comment || 'Approved by Virtual Manager',
    });
  }

  /**
   * Request changes on a PR with required feedback
   */
  async requestChanges(repo: string, prNumber: number, feedback: string): Promise<GitHubReview> {
    return this.submitPRReview(repo, prNumber, {
      event: 'REQUEST_CHANGES',
      body: feedback,
    });
  }

  // ==================== Comments ====================

  async addPRComment(repo: string, prNumber: number, body: string): Promise<void> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    await this.request<any>(
      'POST',
      `/repos/${owner}/${repoName}/issues/${prNumber}/comments`,
      { body }
    );
    logger.info('Added PR comment', { repo, prNumber });
  }

  // ==================== File Operations ====================

  async getFileContent(repo: string, path: string, ref?: string): Promise<string | null> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const endpoint = `/repos/${owner}/${repoName}/contents/${path}${ref ? `?ref=${ref}` : ''}`;

    try {
      const response = await this.request<{ content: string; encoding: string }>(
        'GET',
        endpoint
      );
      if (response.encoding === 'base64') {
        return Buffer.from(response.content, 'base64').toString('utf-8');
      }
      return response.content;
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async getChangedFiles(repo: string, prNumber: number): Promise<string[]> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const response = await this.request<Array<{ filename: string }>>(
      'GET',
      `/repos/${owner}/${repoName}/pulls/${prNumber}/files`
    );
    return response.map(f => f.filename);
  }

  // ==================== Webhooks ====================

  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): Promise<boolean> {
    const crypto = await import('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expected = `sha256=${hmac.digest('hex')}`;
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }
}

// Factory function
let githubService: GitHubService | null = null;

export function getGitHubService(config?: GitHubConfig): GitHubService {
  if (!githubService && config) {
    githubService = new GitHubService(config);
  }
  if (!githubService) {
    throw new Error('GitHubService not initialized - provide config on first call');
  }
  return githubService;
}

export function initGitHubService(config: GitHubConfig): GitHubService {
  githubService = new GitHubService(config);
  return githubService;
}

// Branch name generator for AI worker tasks
export function generateBranchName(issueKey: string, summary: string): string {
  // Convert summary to kebab-case
  const slug = summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);

  return `ai/${issueKey.toLowerCase()}/${slug}`;
}

// PR body template for AI worker tasks
export function generatePRBody(options: {
  issueKey: string;
  summary: string;
  description?: string;
  changedFiles: string[];
  persona: string;
}): string {
  const { issueKey, summary, description, changedFiles, persona } = options;

  let body = `## Summary\n\n`;
  body += `Automated PR for [${issueKey}](https://oncallshift.atlassian.net/browse/${issueKey})\n\n`;
  body += `**${summary}**\n\n`;

  if (description) {
    body += `### Description\n\n${description}\n\n`;
  }

  body += `### Changed Files\n\n`;
  for (const file of changedFiles) {
    body += `- \`${file}\`\n`;
  }

  body += `\n---\n`;
  body += `\n🤖 Generated by AI Worker (${persona.replace(/_/g, ' ')})\n`;
  body += `\n⚠️ **Please review carefully before merging**\n`;

  return body;
}
