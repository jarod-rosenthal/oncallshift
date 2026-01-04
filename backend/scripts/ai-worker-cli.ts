#!/usr/bin/env ts-node
/**
 * AI Worker Control Center CLI
 *
 * Terminal-based monitoring tool for AI Workers
 * Run with: npm run ai:watch
 */

import axios from 'axios';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

// Icons for status
const icons = {
  executing: '🔵',
  completed: '✅',
  failed: '❌',
  queued: '🟡',
  blocked: '🟠',
  cancelled: '⬜',
  idle: '🟢',
  disabled: '🔴',
  paused: '🟡',
};

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://oncallshift.com/api/v1';
const API_KEY = process.env.ONCALLSHIFT_API_KEY;
const REFRESH_INTERVAL = 2000; // 2 seconds

// CLI Options (parsed from args)
interface CLIOptions {
  taskId?: string;
  timeout: number; // 0 = no timeout
  watch: boolean; // Keep watching after task completes
  logLevel: 'debug' | 'info' | 'warning' | 'error';
  noColors: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    timeout: 0,
    watch: false,
    logLevel: 'info',
    noColors: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (arg === '--watch' || arg === '-w') {
      options.watch = true;
    } else if (arg === '--no-colors') {
      options.noColors = true;
    } else if (arg.startsWith('--timeout=')) {
      options.timeout = parseInt(arg.split('=')[1]) * 1000; // Convert to ms
    } else if (arg.startsWith('--log-level=')) {
      const level = arg.split('=')[1] as CLIOptions['logLevel'];
      if (['debug', 'info', 'warning', 'error'].includes(level)) {
        options.logLevel = level;
      }
    } else if (!arg.startsWith('-')) {
      options.taskId = arg;
    }
  }

  return options;
}

interface Stats {
  totalWorkers: number;
  activeWorkers: number;
  queueDepth: number;
  todayCost: number;
  todayCompleted: number;
  todayFailed: number;
}

interface Worker {
  id: string;
  displayName: string;
  persona: string;
  status: string;
  currentTask?: {
    id: string;
    jiraKey: string;
    summary: string;
    progress: number;
  };
}

interface TaskStep {
  name: string;
  status: 'done' | 'active' | 'pending';
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: string;
}

interface ActiveTask {
  id: string;
  jiraIssueKey: string;
  summary: string;
  status: string;
  workerName: string;
  turnCount: number;
  maxTurns: number;
  estimatedCostUsd: number;
  steps: TaskStep[];
  recentLogs: LogEntry[];
}

interface CompletedTask {
  id: string;
  jiraIssueKey: string;
  summary: string;
  status: string;
  costUsd: number;
  durationMinutes: number;
  completedAt: string;
}

interface ControlCenterData {
  stats: Stats;
  workers: Worker[];
  activeTasks: ActiveTask[];
  recentCompleted: CompletedTask[];
}

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function printHeader() {
  console.log(`${colors.bold}${colors.cyan}╭─────────────────────────────────────────────────────────────────╮${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}│${colors.reset}  ${colors.bold}🤖 AI Workers Control Center${colors.reset}                                  ${colors.bold}${colors.cyan}│${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}│${colors.reset}  ${colors.dim}Connected to: ${API_BASE_URL}${colors.reset}`.padEnd(74) + `${colors.bold}${colors.cyan}│${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}╰─────────────────────────────────────────────────────────────────╯${colors.reset}`);
  console.log();
}

function printStats(stats: Stats) {
  const statsLine = [
    `${colors.bold}Workers:${colors.reset} ${stats.totalWorkers}`,
    `${colors.green}Active:${colors.reset} ${stats.activeWorkers}`,
    `${colors.yellow}Queue:${colors.reset} ${stats.queueDepth}`,
    `${colors.blue}Cost Today:${colors.reset} $${stats.todayCost.toFixed(2)}`,
    `${colors.green}Completed:${colors.reset} ${stats.todayCompleted}`,
    `${colors.red}Failed:${colors.reset} ${stats.todayFailed}`,
  ].join('  │  ');

  console.log(`  ${statsLine}`);
  console.log();
}

function printWorkers(workers: Worker[]) {
  console.log(`${colors.bold}WORKERS${colors.reset}`);
  console.log(`┌──────────────────────┬───────────────┬─────────────┬────────────────────────┐`);
  console.log(`│ Name                 │ Status        │ Task        │ Progress               │`);
  console.log(`├──────────────────────┼───────────────┼─────────────┼────────────────────────┤`);

  for (const worker of workers) {
    const statusIcon = getStatusIcon(worker.status);
    const statusText = worker.status.padEnd(10);
    const taskKey = worker.currentTask?.jiraKey || '-';
    const progress = worker.currentTask
      ? renderProgressBar(worker.currentTask.progress, 15)
      : '-'.padEnd(22);

    console.log(`│ ${worker.displayName.padEnd(20)} │ ${statusIcon} ${statusText} │ ${taskKey.padEnd(11)} │ ${progress} │`);
  }

  console.log(`└──────────────────────┴───────────────┴─────────────┴────────────────────────┘`);
  console.log();
}

function getStatusIcon(status: string): string {
  const statusLower = status.toLowerCase();
  if (statusLower === 'executing' || statusLower === 'running') return icons.executing;
  if (statusLower === 'completed' || statusLower === 'done') return icons.completed;
  if (statusLower === 'failed' || statusLower === 'error') return icons.failed;
  if (statusLower === 'queued' || statusLower === 'pending') return icons.queued;
  if (statusLower === 'blocked') return icons.blocked;
  if (statusLower === 'cancelled') return icons.cancelled;
  if (statusLower === 'idle' || statusLower === 'available') return icons.idle;
  if (statusLower === 'disabled' || statusLower === 'offline') return icons.disabled;
  if (statusLower === 'paused') return icons.paused;
  return '⬜';
}

function renderProgressBar(progress: number, width: number): string {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  const bar = `${colors.green}${'█'.repeat(filled)}${colors.gray}${'░'.repeat(empty)}${colors.reset}`;
  return `${bar} ${progress.toString().padStart(3)}%`;
}

function printActiveTasks(tasks: ActiveTask[]) {
  if (tasks.length === 0) {
    console.log(`${colors.bold}ACTIVE TASKS${colors.reset}`);
    console.log(`  ${colors.dim}No active tasks${colors.reset}`);
    console.log();
    return;
  }

  for (const task of tasks) {
    console.log(`${colors.bold}TASK: ${task.jiraIssueKey}${colors.reset} - ${task.summary.substring(0, 50)}`);
    console.log(`${'─'.repeat(67)}`);

    // Print steps
    const stepsLine = task.steps.map(step => {
      if (step.status === 'done') return `${colors.green}✅ ${step.name}${colors.reset}`;
      if (step.status === 'active') return `${colors.blue}🔄 ${step.name}${colors.reset}`;
      return `${colors.dim}⬜ ${step.name}${colors.reset}`;
    }).join('  ');
    console.log(`  ${stepsLine}`);
    console.log(`${'─'.repeat(67)}`);

    // Print task info
    console.log(`  ${colors.dim}Worker:${colors.reset} ${task.workerName}  │  ${colors.dim}Turn:${colors.reset} ${task.turnCount}/${task.maxTurns}  │  ${colors.dim}Cost:${colors.reset} $${task.estimatedCostUsd.toFixed(2)}`);
    console.log();

    // Print recent logs
    if (task.recentLogs.length > 0) {
      console.log(`  ${colors.bold}Recent Activity:${colors.reset}`);
      for (const log of task.recentLogs.slice(-5)) {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const logIcon = getLogIcon(log.type);
        console.log(`    ${colors.dim}${time}${colors.reset} │ ${logIcon} ${log.message.substring(0, 50)}`);
      }
      console.log();
    }
  }
}

function getLogIcon(type: string): string {
  switch (type) {
    case 'read': return '📝';
    case 'write': return '✨';
    case 'edit': return '📝';
    case 'test': return '🧪';
    case 'command': return '⚡';
    case 'error': return '❌';
    case 'success': return '✅';
    default: return '📋';
  }
}

function printRecentCompleted(tasks: CompletedTask[]) {
  console.log(`${colors.bold}RECENT COMPLETED${colors.reset}`);
  console.log(`┌────────────┬──────────────────────────────────┬──────────┬──────────┬─────────┐`);
  console.log(`│ Task       │ Summary                          │ Status   │ Cost     │ Time    │`);
  console.log(`├────────────┼──────────────────────────────────┼──────────┼──────────┼─────────┤`);

  for (const task of tasks.slice(0, 5)) {
    const statusIcon = getStatusIcon(task.status);
    const summary = task.summary.substring(0, 30).padEnd(32);
    const cost = `$${task.costUsd.toFixed(2)}`.padStart(8);
    const time = `${task.durationMinutes}m`.padStart(7);

    console.log(`│ ${task.jiraIssueKey.padEnd(10)} │ ${summary} │ ${statusIcon}       │ ${cost} │ ${time} │`);
  }

  console.log(`└────────────┴──────────────────────────────────┴──────────┴──────────┴─────────┘`);
  console.log();
}

function printFooter(options?: CLIOptions) {
  const timestamp = new Date().toLocaleTimeString();
  let footer = `Last updated: ${timestamp}  │  Press Ctrl+C to exit  │  Refreshing every ${REFRESH_INTERVAL / 1000}s`;

  if (options?.watch) {
    footer += `  │  Watch mode: ON`;
  }
  if (options?.timeout && options.timeout > 0) {
    footer += `  │  Timeout: ${options.timeout / 1000}s`;
  }

  console.log(`${colors.dim}${footer}${colors.reset}`);
}

async function fetchControlCenterData(): Promise<ControlCenterData | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`;
    }

    const response = await axios.get(`${API_BASE_URL}/super-admin/control-center`, { headers });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        console.error(`${colors.red}Error: Unauthorized. Please set ONCALLSHIFT_API_KEY environment variable.${colors.reset}`);
      } else if (error.response?.status === 403) {
        console.error(`${colors.red}Error: Forbidden. Your account does not have super admin access.${colors.reset}`);
      } else {
        console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
      }
    } else {
      console.error(`${colors.red}Error: ${error}${colors.reset}`);
    }
    return null;
  }
}

async function watchTasks(options: CLIOptions) {
  console.log(`${colors.cyan}Starting AI Worker Control Center...${colors.reset}`);
  console.log(`${colors.dim}Connecting to ${API_BASE_URL}${colors.reset}`);

  if (options.taskId) {
    console.log(`${colors.dim}Watching task: ${options.taskId}${colors.reset}`);
  }
  if (options.timeout > 0) {
    console.log(`${colors.dim}Session timeout: ${options.timeout / 1000}s${colors.reset}`);
  }
  if (options.watch) {
    console.log(`${colors.dim}Watch mode: enabled (will continue after task completion)${colors.reset}`);
  }
  if (options.logLevel !== 'info') {
    console.log(`${colors.dim}Log level: ${options.logLevel}${colors.reset}`);
  }
  console.log();

  if (!API_KEY) {
    console.log(`${colors.yellow}Warning: ONCALLSHIFT_API_KEY not set. Using demo mode with mock data.${colors.reset}`);
    console.log();
  }

  const startTime = Date.now();
  let intervalId: NodeJS.Timeout | null = null;
  let lastTaskStatus: string | null = null;

  const refresh = async () => {
    // Check timeout
    if (options.timeout > 0 && Date.now() - startTime > options.timeout) {
      console.log(`\n${colors.yellow}Session timeout reached. Exiting...${colors.reset}`);
      if (intervalId) clearInterval(intervalId);
      process.exit(0);
    }

    let data: ControlCenterData | null;

    if (!API_KEY) {
      // Demo mode with mock data
      data = getMockData();
    } else {
      data = await fetchControlCenterData();
    }

    if (!data) {
      return;
    }

    // If watching a specific task, check if it completed
    if (options.taskId && !options.watch) {
      const activeTask = data.activeTasks.find(t => t.id === options.taskId || t.jiraIssueKey === options.taskId);
      const completedTask = data.recentCompleted.find(t => t.id === options.taskId || t.jiraIssueKey === options.taskId);

      if (!activeTask && completedTask) {
        // Task completed
        if (lastTaskStatus !== completedTask.status) {
          clearScreen();
          printHeader();
          console.log(`${colors.bold}Task ${completedTask.jiraIssueKey} completed!${colors.reset}`);
          console.log(`  Status: ${getStatusIcon(completedTask.status)} ${completedTask.status}`);
          console.log(`  Cost: $${completedTask.costUsd.toFixed(2)}`);
          console.log(`  Duration: ${completedTask.durationMinutes}m`);
          console.log();
          console.log(`${colors.dim}Exiting... Use --watch to keep monitoring${colors.reset}`);

          if (intervalId) clearInterval(intervalId);
          process.exit(completedTask.status === 'completed' ? 0 : 1);
        }
      }
      lastTaskStatus = activeTask?.status || completedTask?.status || null;
    }

    // Filter logs by log level
    if (options.logLevel !== 'debug') {
      const levelPriority: Record<string, number> = { debug: 0, info: 1, warning: 2, error: 3 };
      const minPriority = levelPriority[options.logLevel] || 1;

      for (const task of data.activeTasks) {
        task.recentLogs = task.recentLogs.filter(log => {
          const logPriority = log.type === 'error' ? 3 : log.type === 'warning' ? 2 : 1;
          return logPriority >= minPriority;
        });
      }
    }

    clearScreen();
    printHeader();
    printStats(data.stats);
    printWorkers(data.workers);
    printActiveTasks(data.activeTasks);
    printRecentCompleted(data.recentCompleted);
    printFooter(options);
  };

  // Initial fetch
  await refresh();

  // Start polling
  intervalId = setInterval(refresh, REFRESH_INTERVAL);
}

function getMockData(): ControlCenterData {
  return {
    stats: {
      totalWorkers: 3,
      activeWorkers: 1,
      queueDepth: 2,
      todayCost: 4.20,
      todayCompleted: 5,
      todayFailed: 1,
    },
    workers: [
      {
        id: '1',
        displayName: 'Dev-Worker-1',
        persona: 'developer',
        status: 'executing',
        currentTask: {
          id: '1',
          jiraKey: 'OCS-33',
          summary: 'Add tests for escalation timer',
          progress: 80,
        },
      },
      {
        id: '2',
        displayName: 'QA-Worker-1',
        persona: 'qa',
        status: 'idle',
      },
      {
        id: '3',
        displayName: 'DevOps-Worker-1',
        persona: 'devops',
        status: 'disabled',
      },
    ],
    activeTasks: [
      {
        id: '1',
        jiraIssueKey: 'OCS-33',
        summary: 'Add tests for escalation timer',
        status: 'executing',
        workerName: 'Dev-Worker-1',
        turnCount: 12,
        maxTurns: 50,
        estimatedCostUsd: 0.45,
        steps: [
          { name: 'Claimed', status: 'done' },
          { name: 'Setup', status: 'done' },
          { name: 'Executing', status: 'active' },
          { name: 'PR', status: 'pending' },
          { name: 'Review', status: 'pending' },
        ],
        recentLogs: [
          { timestamp: new Date(Date.now() - 60000).toISOString(), message: 'Reading escalation-timer.ts', type: 'read' },
          { timestamp: new Date(Date.now() - 45000).toISOString(), message: 'Created escalation-timer.test.ts', type: 'write' },
          { timestamp: new Date(Date.now() - 30000).toISOString(), message: 'Running npm test', type: 'test' },
          { timestamp: new Date(Date.now() - 15000).toISOString(), message: 'Tests passing (4/4)', type: 'success' },
          { timestamp: new Date().toISOString(), message: 'Adding more test cases...', type: 'write' },
        ],
      },
    ],
    recentCompleted: [
      {
        id: '2',
        jiraIssueKey: 'OCS-32',
        summary: 'Fix login timeout bug',
        status: 'completed',
        costUsd: 0.82,
        durationMinutes: 12,
        completedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '3',
        jiraIssueKey: 'OCS-31',
        summary: 'Update README',
        status: 'completed',
        costUsd: 0.15,
        durationMinutes: 3,
        completedAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: '4',
        jiraIssueKey: 'OCS-30',
        summary: 'Add dark mode',
        status: 'failed',
        costUsd: 1.20,
        durationMinutes: 25,
        completedAt: new Date(Date.now() - 10800000).toISOString(),
      },
    ],
  };
}

function showHelp() {
  console.log(`
${colors.bold}AI Worker Control Center CLI${colors.reset}

${colors.bold}Usage:${colors.reset}
  npx ts-node scripts/ai-worker-cli.ts [taskId] [options]

${colors.bold}Arguments:${colors.reset}
  taskId                       Watch a specific task (optional)

${colors.bold}Options:${colors.reset}
  -h, --help                   Show this help message
  -w, --watch                  Keep watching even after task completes
  --timeout=SECONDS            Session timeout (0 = no timeout, default: 0)
  --log-level=LEVEL            Filter logs (debug, info, warning, error)
  --no-colors                  Disable colored output

${colors.bold}Environment Variables:${colors.reset}
  ONCALLSHIFT_API_KEY          API key for authentication (required for live data)
  API_BASE_URL                 API base URL (default: https://oncallshift.com/api/v1)

${colors.bold}Examples:${colors.reset}
  npx ts-node scripts/ai-worker-cli.ts                           # Watch all tasks
  npx ts-node scripts/ai-worker-cli.ts abc-123                   # Watch specific task
  npx ts-node scripts/ai-worker-cli.ts --watch                   # Keep watching after completion
  npx ts-node scripts/ai-worker-cli.ts --timeout=3600            # 1 hour session timeout
  npx ts-node scripts/ai-worker-cli.ts --log-level=error         # Only show errors

${colors.bold}Demo Mode:${colors.reset}
  Run without ONCALLSHIFT_API_KEY to see mock data demonstration
`);
}

// Main entry point
const cliOptions = parseArgs();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.cyan}Shutting down...${colors.reset}`);
  process.exit(0);
});

// Start watching
watchTasks(cliOptions).catch(error => {
  console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
  process.exit(1);
});
