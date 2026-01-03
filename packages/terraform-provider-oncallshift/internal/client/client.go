// Copyright (c) OnCallShift
// SPDX-License-Identifier: MPL-2.0

package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is the OnCallShift API client
type Client struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
	UserAgent  string
}

// NewClient creates a new OnCallShift API client
func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		BaseURL: baseURL,
		APIKey:  apiKey,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		UserAgent: "terraform-provider-oncallshift/0.1.0",
	}
}

// APIError represents an error response from the API
type APIError struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	Status   int    `json:"status"`
	Detail   string `json:"detail"`
	Instance string `json:"instance"`
}

func (e *APIError) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("%s: %s", e.Title, e.Detail)
	}
	return e.Title
}

// doRequest performs an HTTP request to the API
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	url := fmt.Sprintf("%s%s", c.BaseURL, path)
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", c.UserAgent)
	req.Header.Set("X-API-Key", c.APIKey)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check for error responses
	if resp.StatusCode >= 400 {
		var apiErr APIError
		if err := json.Unmarshal(respBody, &apiErr); err != nil {
			return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBody))
		}
		apiErr.Status = resp.StatusCode
		return nil, &apiErr
	}

	return respBody, nil
}

// Team represents an OnCallShift team
type Team struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Slug        string    `json:"slug,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// CreateTeam creates a new team
func (c *Client) CreateTeam(ctx context.Context, name, description string) (*Team, error) {
	body := map[string]string{
		"name":        name,
		"description": description,
	}

	respBody, err := c.doRequest(ctx, http.MethodPost, "/teams", body)
	if err != nil {
		return nil, err
	}

	var response struct {
		Team Team `json:"team"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Team, nil
}

// GetTeam retrieves a team by ID
func (c *Client) GetTeam(ctx context.Context, id string) (*Team, error) {
	respBody, err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/teams/%s", id), nil)
	if err != nil {
		return nil, err
	}

	var response struct {
		Team Team `json:"team"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Team, nil
}

// UpdateTeam updates a team
func (c *Client) UpdateTeam(ctx context.Context, id, name, description string) (*Team, error) {
	body := map[string]string{
		"name":        name,
		"description": description,
	}

	respBody, err := c.doRequest(ctx, http.MethodPut, fmt.Sprintf("/teams/%s", id), body)
	if err != nil {
		return nil, err
	}

	var response struct {
		Team Team `json:"team"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Team, nil
}

// DeleteTeam deletes a team
func (c *Client) DeleteTeam(ctx context.Context, id string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/teams/%s", id), nil)
	return err
}

// Service represents an OnCallShift service
type Service struct {
	ID                   string    `json:"id"`
	Name                 string    `json:"name"`
	Description          string    `json:"description,omitempty"`
	Status               string    `json:"status,omitempty"`
	TeamID               string    `json:"teamId,omitempty"`
	EscalationPolicyID   string    `json:"escalationPolicyId,omitempty"`
	AlertCreationSetting string    `json:"alertCreationSetting,omitempty"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

// CreateServiceInput represents the input for creating a service
type CreateServiceInput struct {
	Name                 string `json:"name"`
	Description          string `json:"description,omitempty"`
	TeamID               string `json:"teamId,omitempty"`
	EscalationPolicyID   string `json:"escalationPolicyId,omitempty"`
	AlertCreationSetting string `json:"alertCreationSetting,omitempty"`
}

// CreateService creates a new service
func (c *Client) CreateService(ctx context.Context, input *CreateServiceInput) (*Service, error) {
	respBody, err := c.doRequest(ctx, http.MethodPost, "/services", input)
	if err != nil {
		return nil, err
	}

	var response struct {
		Service Service `json:"service"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Service, nil
}

// GetService retrieves a service by ID
func (c *Client) GetService(ctx context.Context, id string) (*Service, error) {
	respBody, err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/services/%s", id), nil)
	if err != nil {
		return nil, err
	}

	var response struct {
		Service Service `json:"service"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Service, nil
}

// UpdateService updates a service
func (c *Client) UpdateService(ctx context.Context, id string, input *CreateServiceInput) (*Service, error) {
	respBody, err := c.doRequest(ctx, http.MethodPut, fmt.Sprintf("/services/%s", id), input)
	if err != nil {
		return nil, err
	}

	var response struct {
		Service Service `json:"service"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Service, nil
}

// DeleteService deletes a service
func (c *Client) DeleteService(ctx context.Context, id string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/services/%s", id), nil)
	return err
}

// User represents an OnCallShift user
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	FullName  string    `json:"fullName"`
	Role      string    `json:"role,omitempty"`
	Phone     string    `json:"phone,omitempty"`
	Timezone  string    `json:"timezone,omitempty"`
	JobTitle  string    `json:"jobTitle,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CreateUserInput represents the input for creating/inviting a user
type CreateUserInput struct {
	Email    string   `json:"email"`
	FullName string   `json:"fullName"`
	Role     string   `json:"role,omitempty"`
	TeamIDs  []string `json:"teamIds,omitempty"`
}

// CreateUser invites a new user
func (c *Client) CreateUser(ctx context.Context, input *CreateUserInput) (*User, error) {
	respBody, err := c.doRequest(ctx, http.MethodPost, "/users/invite", input)
	if err != nil {
		return nil, err
	}

	var response struct {
		User User `json:"user"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.User, nil
}

// GetUser retrieves a user by ID
func (c *Client) GetUser(ctx context.Context, id string) (*User, error) {
	respBody, err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/users/%s", id), nil)
	if err != nil {
		return nil, err
	}

	var response struct {
		User User `json:"user"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.User, nil
}

// UpdateUserInput represents the input for updating a user
type UpdateUserInput struct {
	FullName string `json:"fullName,omitempty"`
	Role     string `json:"role,omitempty"`
	Phone    string `json:"phone,omitempty"`
	Timezone string `json:"timezone,omitempty"`
	JobTitle string `json:"jobTitle,omitempty"`
}

// UpdateUser updates a user
func (c *Client) UpdateUser(ctx context.Context, id string, input *UpdateUserInput) (*User, error) {
	respBody, err := c.doRequest(ctx, http.MethodPut, fmt.Sprintf("/users/%s", id), input)
	if err != nil {
		return nil, err
	}

	var response struct {
		User User `json:"user"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.User, nil
}

// DeleteUser deletes a user
func (c *Client) DeleteUser(ctx context.Context, id string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/users/%s", id), nil)
	return err
}

// Schedule represents an OnCallShift schedule
type Schedule struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Timezone    string          `json:"timezone"`
	TeamID      string          `json:"teamId,omitempty"`
	Layers      []ScheduleLayer `json:"layers,omitempty"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// ScheduleLayer represents a layer within a schedule
type ScheduleLayer struct {
	ID                   string   `json:"id,omitempty"`
	Name                 string   `json:"name"`
	Start                string   `json:"start"`
	RotationVirtualStart string   `json:"rotationVirtualStart,omitempty"`
	RotationTurnLength   int      `json:"rotationTurnLengthSeconds"`
	Users                []string `json:"users"`
	Restrictions         []string `json:"restrictions,omitempty"`
}

// CreateScheduleInput represents the input for creating a schedule
type CreateScheduleInput struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Timezone    string          `json:"timezone"`
	TeamID      string          `json:"teamId,omitempty"`
	Layers      []ScheduleLayer `json:"layers,omitempty"`
}

// CreateSchedule creates a new schedule
func (c *Client) CreateSchedule(ctx context.Context, input *CreateScheduleInput) (*Schedule, error) {
	respBody, err := c.doRequest(ctx, http.MethodPost, "/schedules", input)
	if err != nil {
		return nil, err
	}

	var response struct {
		Schedule Schedule `json:"schedule"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Schedule, nil
}

// GetSchedule retrieves a schedule by ID
func (c *Client) GetSchedule(ctx context.Context, id string) (*Schedule, error) {
	respBody, err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/schedules/%s", id), nil)
	if err != nil {
		return nil, err
	}

	var response struct {
		Schedule Schedule `json:"schedule"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Schedule, nil
}

// UpdateSchedule updates a schedule
func (c *Client) UpdateSchedule(ctx context.Context, id string, input *CreateScheduleInput) (*Schedule, error) {
	respBody, err := c.doRequest(ctx, http.MethodPut, fmt.Sprintf("/schedules/%s", id), input)
	if err != nil {
		return nil, err
	}

	var response struct {
		Schedule Schedule `json:"schedule"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Schedule, nil
}

// DeleteSchedule deletes a schedule
func (c *Client) DeleteSchedule(ctx context.Context, id string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/schedules/%s", id), nil)
	return err
}

// EscalationPolicy represents an OnCallShift escalation policy
type EscalationPolicy struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description,omitempty"`
	TeamID      string           `json:"teamId,omitempty"`
	Steps       []EscalationStep `json:"steps,omitempty"`
	RepeatCount int              `json:"repeatCount,omitempty"`
	CreatedAt   time.Time        `json:"createdAt"`
	UpdatedAt   time.Time        `json:"updatedAt"`
}

// EscalationStep represents a step in an escalation policy
type EscalationStep struct {
	ID                 string            `json:"id,omitempty"`
	StepNumber         int               `json:"stepNumber"`
	DelayMinutes       int               `json:"delayMinutes"`
	Targets            []EscalationTarget `json:"targets,omitempty"`
}

// EscalationTarget represents a target in an escalation step
type EscalationTarget struct {
	Type string `json:"type"` // "user", "schedule", "team"
	ID   string `json:"id"`
}

// CreateEscalationPolicyInput represents the input for creating an escalation policy
type CreateEscalationPolicyInput struct {
	Name        string           `json:"name"`
	Description string           `json:"description,omitempty"`
	TeamID      string           `json:"teamId,omitempty"`
	Steps       []EscalationStep `json:"steps,omitempty"`
	RepeatCount int              `json:"repeatCount,omitempty"`
}

// CreateEscalationPolicy creates a new escalation policy
func (c *Client) CreateEscalationPolicy(ctx context.Context, input *CreateEscalationPolicyInput) (*EscalationPolicy, error) {
	respBody, err := c.doRequest(ctx, http.MethodPost, "/escalation-policies", input)
	if err != nil {
		return nil, err
	}

	var response struct {
		EscalationPolicy EscalationPolicy `json:"escalationPolicy"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.EscalationPolicy, nil
}

// GetEscalationPolicy retrieves an escalation policy by ID
func (c *Client) GetEscalationPolicy(ctx context.Context, id string) (*EscalationPolicy, error) {
	respBody, err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/escalation-policies/%s", id), nil)
	if err != nil {
		return nil, err
	}

	var response struct {
		EscalationPolicy EscalationPolicy `json:"escalationPolicy"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.EscalationPolicy, nil
}

// UpdateEscalationPolicy updates an escalation policy
func (c *Client) UpdateEscalationPolicy(ctx context.Context, id string, input *CreateEscalationPolicyInput) (*EscalationPolicy, error) {
	respBody, err := c.doRequest(ctx, http.MethodPut, fmt.Sprintf("/escalation-policies/%s", id), input)
	if err != nil {
		return nil, err
	}

	var response struct {
		EscalationPolicy EscalationPolicy `json:"escalationPolicy"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.EscalationPolicy, nil
}

// DeleteEscalationPolicy deletes an escalation policy
func (c *Client) DeleteEscalationPolicy(ctx context.Context, id string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/escalation-policies/%s", id), nil)
	return err
}

// Integration represents an OnCallShift integration
type Integration struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"` // "generic", "datadog", "cloudwatch", "prometheus", etc.
	ServiceID   string    `json:"serviceId"`
	IntegrationKey string `json:"integrationKey,omitempty"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// CreateIntegrationInput represents the input for creating an integration
type CreateIntegrationInput struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	ServiceID string `json:"serviceId"`
	Enabled   bool   `json:"enabled"`
}

// CreateIntegration creates a new integration
func (c *Client) CreateIntegration(ctx context.Context, input *CreateIntegrationInput) (*Integration, error) {
	respBody, err := c.doRequest(ctx, http.MethodPost, "/integrations", input)
	if err != nil {
		return nil, err
	}

	var response struct {
		Integration Integration `json:"integration"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Integration, nil
}

// GetIntegration retrieves an integration by ID
func (c *Client) GetIntegration(ctx context.Context, id string) (*Integration, error) {
	respBody, err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/integrations/%s", id), nil)
	if err != nil {
		return nil, err
	}

	var response struct {
		Integration Integration `json:"integration"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Integration, nil
}

// UpdateIntegration updates an integration
func (c *Client) UpdateIntegration(ctx context.Context, id string, input *CreateIntegrationInput) (*Integration, error) {
	respBody, err := c.doRequest(ctx, http.MethodPut, fmt.Sprintf("/integrations/%s", id), input)
	if err != nil {
		return nil, err
	}

	var response struct {
		Integration Integration `json:"integration"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Integration, nil
}

// DeleteIntegration deletes an integration
func (c *Client) DeleteIntegration(ctx context.Context, id string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/integrations/%s", id), nil)
	return err
}

// RoutingRule represents an OnCallShift routing rule
type RoutingRule struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Description     string    `json:"description,omitempty"`
	Conditions      string    `json:"conditions,omitempty"` // JSON conditions
	TargetServiceID string    `json:"targetServiceId"`
	RuleOrder       int       `json:"ruleOrder"`
	Enabled         bool      `json:"enabled"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// CreateRoutingRuleInput represents the input for creating a routing rule
type CreateRoutingRuleInput struct {
	Name            string `json:"name"`
	Description     string `json:"description,omitempty"`
	Conditions      string `json:"conditions,omitempty"`
	TargetServiceID string `json:"targetServiceId"`
	RuleOrder       int    `json:"ruleOrder"`
	Enabled         bool   `json:"enabled"`
}

// CreateRoutingRule creates a new routing rule
func (c *Client) CreateRoutingRule(ctx context.Context, input *CreateRoutingRuleInput) (*RoutingRule, error) {
	respBody, err := c.doRequest(ctx, http.MethodPost, "/routing-rules", input)
	if err != nil {
		return nil, err
	}

	var response struct {
		RoutingRule RoutingRule `json:"routingRule"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.RoutingRule, nil
}

// GetRoutingRule retrieves a routing rule by ID
func (c *Client) GetRoutingRule(ctx context.Context, id string) (*RoutingRule, error) {
	respBody, err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/routing-rules/%s", id), nil)
	if err != nil {
		return nil, err
	}

	var response struct {
		RoutingRule RoutingRule `json:"routingRule"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.RoutingRule, nil
}

// UpdateRoutingRule updates a routing rule
func (c *Client) UpdateRoutingRule(ctx context.Context, id string, input *CreateRoutingRuleInput) (*RoutingRule, error) {
	respBody, err := c.doRequest(ctx, http.MethodPut, fmt.Sprintf("/routing-rules/%s", id), input)
	if err != nil {
		return nil, err
	}

	var response struct {
		RoutingRule RoutingRule `json:"routingRule"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.RoutingRule, nil
}

// DeleteRoutingRule deletes a routing rule
func (c *Client) DeleteRoutingRule(ctx context.Context, id string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/routing-rules/%s", id), nil)
	return err
}

// Runbook represents an OnCallShift runbook
type Runbook struct {
	ID          string        `json:"id"`
	Title       string        `json:"title"`
	Description string        `json:"description,omitempty"`
	Content     string        `json:"content,omitempty"`
	ServiceID   string        `json:"serviceId,omitempty"`
	Tags        []string      `json:"tags,omitempty"`
	Steps       []RunbookStep `json:"steps,omitempty"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

// RunbookStep represents a step in a runbook
type RunbookStep struct {
	Order       int    `json:"order"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Command     string `json:"command,omitempty"`
}

// CreateRunbookInput represents the input for creating a runbook
type CreateRunbookInput struct {
	Title       string        `json:"title"`
	Description string        `json:"description,omitempty"`
	Content     string        `json:"content,omitempty"`
	ServiceID   string        `json:"serviceId,omitempty"`
	Tags        []string      `json:"tags,omitempty"`
	Steps       []RunbookStep `json:"steps,omitempty"`
}

// CreateRunbook creates a new runbook
func (c *Client) CreateRunbook(ctx context.Context, input *CreateRunbookInput) (*Runbook, error) {
	respBody, err := c.doRequest(ctx, http.MethodPost, "/runbooks", input)
	if err != nil {
		return nil, err
	}

	var response struct {
		Runbook Runbook `json:"runbook"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Runbook, nil
}

// GetRunbook retrieves a runbook by ID
func (c *Client) GetRunbook(ctx context.Context, id string) (*Runbook, error) {
	respBody, err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/runbooks/%s", id), nil)
	if err != nil {
		return nil, err
	}

	var response struct {
		Runbook Runbook `json:"runbook"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Runbook, nil
}

// UpdateRunbook updates a runbook
func (c *Client) UpdateRunbook(ctx context.Context, id string, input *CreateRunbookInput) (*Runbook, error) {
	respBody, err := c.doRequest(ctx, http.MethodPut, fmt.Sprintf("/runbooks/%s", id), input)
	if err != nil {
		return nil, err
	}

	var response struct {
		Runbook Runbook `json:"runbook"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Runbook, nil
}

// DeleteRunbook deletes a runbook
func (c *Client) DeleteRunbook(ctx context.Context, id string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/runbooks/%s", id), nil)
	return err
}

// Workflow represents an OnCallShift workflow
type Workflow struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	TriggerType string         `json:"triggerType"` // "incident.triggered", "incident.acknowledged", etc.
	Enabled     bool           `json:"enabled"`
	Actions     []WorkflowAction `json:"actions,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

// WorkflowAction represents an action in a workflow
type WorkflowAction struct {
	Type   string            `json:"type"` // "webhook", "slack", "email", etc.
	Config map[string]string `json:"config,omitempty"`
}

// CreateWorkflowInput represents the input for creating a workflow
type CreateWorkflowInput struct {
	Name        string           `json:"name"`
	Description string           `json:"description,omitempty"`
	TriggerType string           `json:"triggerType"`
	Enabled     bool             `json:"enabled"`
	Actions     []WorkflowAction `json:"actions,omitempty"`
}

// CreateWorkflow creates a new workflow
func (c *Client) CreateWorkflow(ctx context.Context, input *CreateWorkflowInput) (*Workflow, error) {
	respBody, err := c.doRequest(ctx, http.MethodPost, "/workflows", input)
	if err != nil {
		return nil, err
	}

	var response struct {
		Workflow Workflow `json:"workflow"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Workflow, nil
}

// GetWorkflow retrieves a workflow by ID
func (c *Client) GetWorkflow(ctx context.Context, id string) (*Workflow, error) {
	respBody, err := c.doRequest(ctx, http.MethodGet, fmt.Sprintf("/workflows/%s", id), nil)
	if err != nil {
		return nil, err
	}

	var response struct {
		Workflow Workflow `json:"workflow"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Workflow, nil
}

// UpdateWorkflow updates a workflow
func (c *Client) UpdateWorkflow(ctx context.Context, id string, input *CreateWorkflowInput) (*Workflow, error) {
	respBody, err := c.doRequest(ctx, http.MethodPut, fmt.Sprintf("/workflows/%s", id), input)
	if err != nil {
		return nil, err
	}

	var response struct {
		Workflow Workflow `json:"workflow"`
	}
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &response.Workflow, nil
}

// DeleteWorkflow deletes a workflow
func (c *Client) DeleteWorkflow(ctx context.Context, id string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/workflows/%s", id), nil)
	return err
}
