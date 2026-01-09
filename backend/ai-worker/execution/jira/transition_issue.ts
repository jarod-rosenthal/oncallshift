#!/usr/bin/env npx ts-node

/**
 * Transition a Jira issue to a new status
 *
 * Inputs (environment variables):
 * - JIRA_KEY or JIRA_ISSUE_KEY: Required. The Jira issue key (e.g., "OCS-123")
 * - TRANSITION_NAME: Required. The transition name (e.g., "Done", "In Progress")
 * - TRANSITION_ID: Optional. The transition ID (if known, skips lookup)
 * - JIRA_BASE_URL: Required. Jira instance URL (e.g., "https://oncallshift.atlassian.net")
 * - JIRA_EMAIL: Required. Jira user email
 * - JIRA_API_TOKEN: Required. Jira API token
 *
 * Outputs (JSON to stdout):
 * - success: boolean
 * - transitionId: string - The transition ID used
 * - transitionName: string - The transition name
 * - error?: string - Error message if failed
 */

import * as https from "https";
import * as http from "http";

interface Output {
  success: boolean;
  transitionId?: string;
  transitionName?: string;
  error?: string;
}

interface JiraTransition {
  id: string;
  name: string;
}

interface JiraTransitionsResponse {
  transitions: JiraTransition[];
}

function makeRequest(
  url: string,
  options: https.RequestOptions,
  body?: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === "https:" ? https : http;

    const req = protocol.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode || 0, body: data });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function main(): Promise<void> {
  const output: Output = { success: false };

  try {
    const jiraKey = process.env.JIRA_KEY || process.env.JIRA_ISSUE_KEY;
    const transitionName = process.env.TRANSITION_NAME;
    let transitionId = process.env.TRANSITION_ID;
    const jiraBaseUrl = process.env.JIRA_BASE_URL;
    const jiraEmail = process.env.JIRA_EMAIL;
    const jiraApiToken = process.env.JIRA_API_TOKEN;

    if (!jiraKey) {
      throw new Error("JIRA_KEY or JIRA_ISSUE_KEY environment variable is required");
    }
    if (!transitionName && !transitionId) {
      throw new Error("TRANSITION_NAME or TRANSITION_ID environment variable is required");
    }
    if (!jiraBaseUrl) {
      throw new Error("JIRA_BASE_URL environment variable is required");
    }
    if (!jiraEmail) {
      throw new Error("JIRA_EMAIL environment variable is required");
    }
    if (!jiraApiToken) {
      throw new Error("JIRA_API_TOKEN environment variable is required");
    }

    // Create auth header (Basic auth with email:token)
    const authString = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString("base64");
    const authHeader = `Basic ${authString}`;

    // If we don't have a transition ID, look it up by name
    if (!transitionId && transitionName) {
      const transitionsUrl = `${jiraBaseUrl}/rest/api/3/issue/${jiraKey}/transitions`;

      const transitionsResponse = await makeRequest(transitionsUrl, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      });

      if (transitionsResponse.statusCode !== 200) {
        throw new Error(`Failed to get transitions: ${transitionsResponse.statusCode} ${transitionsResponse.body.slice(0, 200)}`);
      }

      const transitionsData: JiraTransitionsResponse = JSON.parse(transitionsResponse.body);

      // Find transition by name (case-insensitive)
      const transition = transitionsData.transitions.find(
        (t) => t.name.toLowerCase() === transitionName.toLowerCase()
      );

      if (!transition) {
        const availableTransitions = transitionsData.transitions.map((t) => t.name).join(", ");
        throw new Error(`Transition "${transitionName}" not found. Available: ${availableTransitions}`);
      }

      transitionId = transition.id;
      output.transitionName = transition.name;
    }

    output.transitionId = transitionId;

    // Perform the transition
    const transitionUrl = `${jiraBaseUrl}/rest/api/3/issue/${jiraKey}/transitions`;
    const requestBody = JSON.stringify({
      transition: { id: transitionId },
    });

    const response = await makeRequest(
      transitionUrl,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
        },
      },
      requestBody,
    );

    if (response.statusCode === 204 || response.statusCode === 200) {
      output.success = true;
      console.error(`[Jira] Successfully transitioned ${jiraKey} to ${output.transitionName || transitionId}`);
    } else {
      let errorMessage = `Jira API returned status ${response.statusCode}`;
      try {
        const errorBody = JSON.parse(response.body);
        if (errorBody.errorMessages) {
          errorMessage += `: ${errorBody.errorMessages.join(", ")}`;
        }
      } catch {
        errorMessage += `: ${response.body.slice(0, 200)}`;
      }
      throw new Error(errorMessage);
    }
  } catch (error: unknown) {
    output.error = error instanceof Error ? error.message : String(error);
    output.success = false;
  }

  console.log(JSON.stringify(output));
  process.exit(output.success ? 0 : 1);
}

main();
