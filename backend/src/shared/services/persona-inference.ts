/**
 * Persona Inference Service
 *
 * Determines the appropriate AI worker persona based on Jira ticket metadata.
 * This ensures the RIGHT worker picks up each task, not just the fastest.
 */

export type WorkerPersona =
  | "frontend_developer"
  | "backend_developer"
  | "devops_engineer"
  | "security_engineer"
  | "qa_engineer"
  | "tech_writer"
  | "project_manager";

interface JiraIssue {
  summary?: string;
  description?: string | null;  // fetchJiraIssue returns null, not undefined
  issueType?: string;
  labels?: string[];
  fields?: Record<string, any>;
}

/**
 * Infer the appropriate worker persona from Jira ticket metadata
 *
 * Priority order (smart inference first, labels as fallback):
 * 1. Keyword-based inference from summary/description (PRIMARY - most accurate)
 * 2. Component-based inference (e.g., component "Frontend" → frontend_developer)
 * 3. Issue type mapping (e.g., "Security" → security_engineer)
 * 4. Explicit persona label (FALLBACK - e.g., "backend", "qa")
 * 5. Default fallback (backend_developer)
 */
export function inferPersonaFromJiraIssue(
  jiraIssue?: JiraIssue,
  explicitPersona?: WorkerPersona
): WorkerPersona {
  // If explicit persona provided via API, use it
  if (explicitPersona) {
    return explicitPersona;
  }

  if (!jiraIssue) {
    return "backend_developer"; // Default fallback
  }

  const labels = jiraIssue.labels || [];
  const summary = (jiraIssue.summary || "").toLowerCase();
  const description = (jiraIssue.description || "").toLowerCase();  // null coerces to ""
  const issueType = (jiraIssue.issueType || "").toLowerCase();
  const text = `${summary} ${description}`;

  // Priority 1: Keyword-based inference from summary/description (PRIMARY)
  // Score ALL personas by keyword matches, pick the highest score
  const personaScores: Record<WorkerPersona, number> = {
    frontend_developer: 0,
    backend_developer: 0,
    devops_engineer: 0,
    security_engineer: 0,
    qa_engineer: 0,
    tech_writer: 0,
    project_manager: 0,
  };

  const keywordPatterns: Record<WorkerPersona, RegExp> = {
    frontend_developer: /\b(react|component|ui|ux|frontend|css|tailwind|mobile|react native|expo|vite|tailwindcss)\b/gi,
    backend_developer: /\b(api|endpoint|typeorm|sql|backend|server|lambda|express|route|controller)\b/gi,
    devops_engineer: /\b(terraform|infrastructure|cicd|deployment|docker|kubernetes|aws|cloudfront|s3|rds|cloudwatch|ecs|ecr|vpc|iam)\b/gi,
    security_engineer: /\b(security|vulnerability|cve|encryption|authentication|authorization|cors|xss|sql injection|owasp)\b/gi,
    qa_engineer: /\b(test|testing|qa|e2e|unit test|integration test|playwright|jest|coverage|spec)\b/gi,
    tech_writer: /\b(documentation|docs|readme|guide|tutorial|api docs|openapi|docusaurus)\b/gi,
    project_manager: /\b(roadmap|planning|coordination|milestone|sprint|epic|backlog)\b/gi,
  };

  // Count matches for each persona
  for (const [persona, pattern] of Object.entries(keywordPatterns)) {
    const matches = text.match(pattern);
    if (matches) {
      personaScores[persona as WorkerPersona] = matches.length;
    }
  }

  // Find persona with highest score
  let maxScore = 0;
  let bestPersona: WorkerPersona | null = null;

  for (const [persona, score] of Object.entries(personaScores)) {
    if (score > maxScore) {
      maxScore = score;
      bestPersona = persona as WorkerPersona;
    }
  }

  // If we found a clear winner (score > 0), use it
  if (bestPersona && maxScore > 0) {
    return bestPersona;
  }

  // Priority 2: Component-based inference
  const components = jiraIssue.fields?.components || [];
  for (const component of components) {
    const componentName = (component.name || "").toLowerCase();
    if (componentName.includes("frontend") || componentName.includes("ui")) {
      return "frontend_developer";
    }
    if (componentName.includes("backend") || componentName.includes("api")) {
      return "backend_developer";
    }
    if (componentName.includes("infrastructure") || componentName.includes("devops")) {
      return "devops_engineer";
    }
    if (componentName.includes("security")) {
      return "security_engineer";
    }
    if (componentName.includes("qa") || componentName.includes("test")) {
      return "qa_engineer";
    }
    if (componentName.includes("docs") || componentName.includes("documentation")) {
      return "tech_writer";
    }
  }

  // Priority 3: Issue type mapping
  if (issueType === "bug" || issueType === "defect") {
    // Bugs could be anywhere, keyword matching above is more accurate
    // If no keywords matched, continue to fallback
  }

  // Priority 4: Explicit persona labels (FALLBACK ONLY)
  // Support both "persona:backend_developer" and "backend_developer" formats
  const personaLabel = labels.find(l => l.startsWith("persona:"));
  if (personaLabel) {
    const persona = personaLabel.replace("persona:", "") as WorkerPersona;
    if (isValidPersona(persona)) {
      return persona;
    }
  }

  // Also check for direct persona labels
  const directPersona = labels.find(l => isValidPersona(l));
  if (directPersona && isValidPersona(directPersona)) {
    return directPersona as WorkerPersona;
  }

  // Check for short-form labels (e.g., "backend", "frontend", "qa")
  const labelMap: Record<string, WorkerPersona> = {
    backend: "backend_developer",
    frontend: "frontend_developer",
    devops: "devops_engineer",
    infra: "devops_engineer",
    infrastructure: "devops_engineer",
    security: "security_engineer",
    qa: "qa_engineer",
    testing: "qa_engineer",
    docs: "tech_writer",
    documentation: "tech_writer",
    pm: "project_manager",
    manager: "project_manager",
  };

  for (const label of labels) {
    const lowerLabel = label.toLowerCase();
    if (labelMap[lowerLabel]) {
      return labelMap[lowerLabel];
    }
  }

  // Priority 5: Default fallback
  return "backend_developer";
}

/**
 * Validate that a string is a valid worker persona
 */
function isValidPersona(persona: string): persona is WorkerPersona {
  const validPersonas: WorkerPersona[] = [
    "frontend_developer",
    "backend_developer",
    "devops_engineer",
    "security_engineer",
    "qa_engineer",
    "tech_writer",
    "project_manager",
  ];
  return validPersonas.includes(persona as WorkerPersona);
}

/**
 * Get a human-readable description of why a persona was chosen
 */
export function getPersonaRationale(
  jiraIssue?: JiraIssue,
  inferredPersona?: WorkerPersona
): string {
  if (!jiraIssue || !inferredPersona) {
    return "Default persona (no Jira data available)";
  }

  const labels = jiraIssue.labels || [];
  const summary = (jiraIssue.summary || "").toLowerCase();
  const description = (jiraIssue.description || "").toLowerCase();
  const text = `${summary} ${description}`;

  // Check for explicit label
  const personaLabel = labels.find(l => l.startsWith("persona:"));
  if (personaLabel) {
    return `Explicit label: ${personaLabel}`;
  }

  // Check for component
  const components = jiraIssue.fields?.components || [];
  for (const component of components) {
    const componentName = (component.name || "").toLowerCase();
    if (componentName && inferredPersona.includes(componentName)) {
      return `Component: ${component.name}`;
    }
  }

  // Calculate keyword scores to show rationale
  const keywordPatterns: Record<WorkerPersona, RegExp> = {
    frontend_developer: /\b(react|component|ui|ux|frontend|css|tailwind|mobile|react native|expo|vite)\b/gi,
    backend_developer: /\b(api|endpoint|typeorm|sql|backend|server|lambda|express|route)\b/gi,
    devops_engineer: /\b(terraform|infrastructure|cicd|deployment|docker|kubernetes|aws|cloudfront|s3|rds|cloudwatch|ecs)\b/gi,
    security_engineer: /\b(security|vulnerability|cve|encryption|authentication|authorization|cors|xss)\b/gi,
    qa_engineer: /\b(test|testing|qa|e2e|unit test|integration test|playwright|jest|coverage)\b/gi,
    tech_writer: /\b(documentation|docs|readme|guide|tutorial|api docs|openapi)\b/gi,
    project_manager: /\b(roadmap|planning|coordination|milestone|sprint|epic)\b/gi,
  };

  const personaScores: Record<string, number> = {};
  let totalMatches = 0;

  for (const [persona, pattern] of Object.entries(keywordPatterns)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      personaScores[persona] = matches.length;
      totalMatches += matches.length;
    }
  }

  if (totalMatches > 0) {
    const scoreStr = Object.entries(personaScores)
      .filter(([_, score]) => score > 0)
      .map(([persona, score]) => `${persona.replace('_', ' ')}=${score}`)
      .join(', ');
    return `Keyword scoring: ${scoreStr}`;
  }

  return "Default inference (no keywords matched)";
}
