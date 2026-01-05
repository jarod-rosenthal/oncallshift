#!/usr/bin/env npx ts-node

/**
 * Add a comment to a Jira issue
 *
 * Inputs (environment variables):
 * - JIRA_KEY: Required. The Jira issue key (e.g., "OCS-123")
 * - COMMENT: Required. The comment text (supports Jira wiki markup or ADF)
 * - JIRA_BASE_URL: Required. Jira instance URL (e.g., "https://oncallshift.atlassian.net")
 * - JIRA_EMAIL: Required. Jira user email
 * - JIRA_API_TOKEN: Required. Jira API token
 * - USE_ADF: Optional. If "true", treat COMMENT as Atlassian Document Format JSON
 *
 * Outputs (JSON to stdout):
 * - success: boolean
 * - commentId: string - The created comment ID
 * - commentUrl: string - URL to view the comment
 * - error?: string - Error message if failed
 */

import * as https from "https";
import * as http from "http";

interface Output {
  success: boolean;
  commentId?: string;
  commentUrl?: string;
  error?: string;
}

interface JiraCommentResponse {
  id: string;
  self: string;
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

function textToAdf(text: string): object {
  // Convert plain text to Atlassian Document Format
  const paragraphs = text.split("\n\n").map((para) => ({
    type: "paragraph",
    content: [
      {
        type: "text",
        text: para.replace(/\n/g, " "),
      },
    ],
  }));

  return {
    type: "doc",
    version: 1,
    content: paragraphs,
  };
}

async function main(): Promise<void> {
  const output: Output = { success: false };

  try {
    const jiraKey = process.env.JIRA_KEY || process.env.JIRA_ISSUE_KEY;
    const comment = process.env.COMMENT;
    const jiraBaseUrl = process.env.JIRA_BASE_URL;
    const jiraEmail = process.env.JIRA_EMAIL;
    const jiraApiToken = process.env.JIRA_API_TOKEN;
    const useAdf = process.env.USE_ADF === "true";

    if (!jiraKey) {
      throw new Error("JIRA_KEY environment variable is required");
    }
    if (!comment) {
      throw new Error("COMMENT environment variable is required");
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

    // Prepare comment body
    let commentBody: object;
    if (useAdf) {
      try {
        commentBody = { body: JSON.parse(comment) };
      } catch {
        throw new Error("USE_ADF is true but COMMENT is not valid JSON");
      }
    } else {
      commentBody = { body: textToAdf(comment) };
    }

    // Build the API URL
    const apiUrl = `${jiraBaseUrl}/rest/api/3/issue/${jiraKey}/comment`;

    // Create auth header (Basic auth with email:token)
    const authString = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString(
      "base64",
    );

    const requestBody = JSON.stringify(commentBody);

    const response = await makeRequest(
      apiUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
        },
      },
      requestBody,
    );

    if (response.statusCode === 201 || response.statusCode === 200) {
      const responseData: JiraCommentResponse = JSON.parse(response.body);
      output.commentId = responseData.id;
      output.commentUrl = `${jiraBaseUrl}/browse/${jiraKey}?focusedCommentId=${responseData.id}`;
      output.success = true;
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
