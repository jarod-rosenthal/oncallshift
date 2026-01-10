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
  description?: string;
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
  const description = (jiraIssue.description || "").toLowerCase();
  const issueType = (jiraIssue.issueType || "").toLowerCase();
  const text = `${summary} ${description}`;

  // Priority 1: Keyword-based inference from summary/description (PRIMARY)
  // Frontend keywords
  if (
    /\b(react|component|ui|ux|frontend|css|tailwind|mobile|react native|expo)\b/.test(text)
  ) {
    return "frontend_developer";
  }

  // Backend keywords
  if (
    /\b(api|endpoint|database|migration|typeorm|sql|backend|server|lambda|ecs)\b/.test(text)
  ) {
    return "backend_developer";
  }

  // DevOps keywords
  if (
    /\b(terraform|infrastructure|cicd|deployment|docker|kubernetes|aws|cloudfront|s3|rds)\b/.test(text)
  ) {
    return "devops_engineer";
  }

  // Security keywords
  if (
    /\b(security|vulnerability|cve|encryption|authentication|authorization|cors|xss|sql injection)\b/.test(text)
  ) {
    return "security_engineer";
  }

  // QA keywords
  if (
    /\b(test|testing|qa|e2e|unit test|integration test|playwright|jest|coverage)\b/.test(text)
  ) {
    return "qa_engineer";
  }

  // Tech writer keywords
  if (
    /\b(documentation|docs|readme|guide|tutorial|api docs|openapi)\b/.test(text)
  ) {
    return "tech_writer";
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

  // Check for keywords
  const keywordMap: Record<WorkerPersona, RegExp> = {
    frontend_developer: /\b(react|component|ui|frontend|mobile)\b/,
    backend_developer: /\b(api|endpoint|database|backend|server)\b/,
    devops_engineer: /\b(terraform|infrastructure|cicd|deployment|docker)\b/,
    security_engineer: /\b(security|vulnerability|encryption|authentication)\b/,
    qa_engineer: /\b(test|testing|qa|e2e|coverage)\b/,
    tech_writer: /\b(documentation|docs|readme|guide)\b/,
    project_manager: /\b(roadmap|planning|coordination)\b/,
  };

  const pattern = keywordMap[inferredPersona];
  if (pattern && pattern.test(text)) {
    const match = text.match(pattern);
    return `Keyword match: "${match?.[0]}" in summary/description`;
  }

  return "Default inference based on issue type";
}
