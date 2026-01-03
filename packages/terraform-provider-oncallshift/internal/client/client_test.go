// Copyright (c) OnCallShift
// SPDX-License-Identifier: MPL-2.0

package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewClient(t *testing.T) {
	client := NewClient("https://api.example.com", "test-api-key")

	if client.BaseURL != "https://api.example.com" {
		t.Errorf("expected BaseURL to be https://api.example.com, got %s", client.BaseURL)
	}
	if client.APIKey != "test-api-key" {
		t.Errorf("expected APIKey to be test-api-key, got %s", client.APIKey)
	}
	if client.HTTPClient == nil {
		t.Error("expected HTTPClient to be initialized")
	}
}

func TestCreateTeam(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/teams" {
			t.Errorf("expected /teams, got %s", r.URL.Path)
		}
		if r.Header.Get("X-API-Key") != "test-key" {
			t.Errorf("expected X-API-Key header")
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected Content-Type application/json")
		}

		// Return response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"team": map[string]interface{}{
				"id":          "team-123",
				"name":        "Platform",
				"description": "Platform team",
				"slug":        "platform",
				"createdAt":   time.Now().Format(time.RFC3339),
				"updatedAt":   time.Now().Format(time.RFC3339),
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")
	team, err := client.CreateTeam(context.Background(), "Platform", "Platform team")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if team.ID != "team-123" {
		t.Errorf("expected team ID team-123, got %s", team.ID)
	}
	if team.Name != "Platform" {
		t.Errorf("expected team name Platform, got %s", team.Name)
	}
}

func TestGetTeam(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/teams/team-123" {
			t.Errorf("expected /teams/team-123, got %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"team": map[string]interface{}{
				"id":          "team-123",
				"name":        "Platform",
				"description": "Platform team",
				"slug":        "platform",
				"createdAt":   time.Now().Format(time.RFC3339),
				"updatedAt":   time.Now().Format(time.RFC3339),
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")
	team, err := client.GetTeam(context.Background(), "team-123")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if team.ID != "team-123" {
		t.Errorf("expected team ID team-123, got %s", team.ID)
	}
}

func TestUpdateTeam(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Errorf("expected PUT, got %s", r.Method)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"team": map[string]interface{}{
				"id":          "team-123",
				"name":        "Updated Platform",
				"description": "Updated description",
				"slug":        "updated-platform",
				"createdAt":   time.Now().Format(time.RFC3339),
				"updatedAt":   time.Now().Format(time.RFC3339),
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")
	team, err := client.UpdateTeam(context.Background(), "team-123", "Updated Platform", "Updated description")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if team.Name != "Updated Platform" {
		t.Errorf("expected team name Updated Platform, got %s", team.Name)
	}
}

func TestDeleteTeam(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("expected DELETE, got %s", r.Method)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")
	err := client.DeleteTeam(context.Background(), "team-123")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCreateService(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": map[string]interface{}{
				"id":                   "svc-123",
				"name":                 "API Service",
				"description":          "Main API",
				"status":               "active",
				"teamId":               "team-123",
				"escalationPolicyId":   "ep-123",
				"alertCreationSetting": "create_incidents",
				"createdAt":            time.Now().Format(time.RFC3339),
				"updatedAt":            time.Now().Format(time.RFC3339),
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")
	service, err := client.CreateService(context.Background(), &CreateServiceInput{
		Name:               "API Service",
		Description:        "Main API",
		TeamID:             "team-123",
		EscalationPolicyID: "ep-123",
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if service.ID != "svc-123" {
		t.Errorf("expected service ID svc-123, got %s", service.ID)
	}
	if service.Status != "active" {
		t.Errorf("expected status active, got %s", service.Status)
	}
}

func TestGetService(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": map[string]interface{}{
				"id":        "svc-123",
				"name":      "API Service",
				"status":    "active",
				"createdAt": time.Now().Format(time.RFC3339),
				"updatedAt": time.Now().Format(time.RFC3339),
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")
	service, err := client.GetService(context.Background(), "svc-123")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if service.ID != "svc-123" {
		t.Errorf("expected service ID svc-123, got %s", service.ID)
	}
}

func TestAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"type":   "https://oncallshift.com/problems/not-found",
			"title":  "Resource Not Found",
			"status": 404,
			"detail": "Team with ID 'team-999' was not found",
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")
	_, err := client.GetTeam(context.Background(), "team-999")

	if err == nil {
		t.Fatal("expected error, got nil")
	}

	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.Status != 404 {
		t.Errorf("expected status 404, got %d", apiErr.Status)
	}
	if apiErr.Title != "Resource Not Found" {
		t.Errorf("expected title 'Resource Not Found', got %s", apiErr.Title)
	}
}

func TestCreateUser(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/users/invite" {
			t.Errorf("expected /users/invite, got %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"user": map[string]interface{}{
				"id":        "user-123",
				"email":     "alice@example.com",
				"fullName":  "Alice Smith",
				"role":      "user",
				"timezone":  "America/New_York",
				"createdAt": time.Now().Format(time.RFC3339),
				"updatedAt": time.Now().Format(time.RFC3339),
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")
	user, err := client.CreateUser(context.Background(), &CreateUserInput{
		Email:    "alice@example.com",
		FullName: "Alice Smith",
		Role:     "user",
		TeamIDs:  []string{"team-123"},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user.ID != "user-123" {
		t.Errorf("expected user ID user-123, got %s", user.ID)
	}
	if user.Email != "alice@example.com" {
		t.Errorf("expected email alice@example.com, got %s", user.Email)
	}
}

func TestCreateSchedule(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"schedule": map[string]interface{}{
				"id":          "sched-123",
				"name":        "Primary On-Call",
				"description": "Primary rotation",
				"timezone":    "America/New_York",
				"teamId":      "team-123",
				"layers": []map[string]interface{}{
					{
						"id":                       "layer-1",
						"name":                     "Layer 1",
						"start":                    "2024-01-01T00:00:00Z",
						"rotationTurnLengthSeconds": 604800,
						"users":                    []string{"user-1", "user-2"},
					},
				},
				"createdAt": time.Now().Format(time.RFC3339),
				"updatedAt": time.Now().Format(time.RFC3339),
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")
	schedule, err := client.CreateSchedule(context.Background(), &CreateScheduleInput{
		Name:     "Primary On-Call",
		Timezone: "America/New_York",
		TeamID:   "team-123",
		Layers: []ScheduleLayer{
			{
				Name:               "Layer 1",
				Start:              "2024-01-01T00:00:00Z",
				RotationTurnLength: 604800,
				Users:              []string{"user-1", "user-2"},
			},
		},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if schedule.ID != "sched-123" {
		t.Errorf("expected schedule ID sched-123, got %s", schedule.ID)
	}
	if len(schedule.Layers) != 1 {
		t.Errorf("expected 1 layer, got %d", len(schedule.Layers))
	}
}

func TestCreateEscalationPolicy(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"escalationPolicy": map[string]interface{}{
				"id":          "ep-123",
				"name":        "Default Escalation",
				"description": "Default policy",
				"teamId":      "team-123",
				"repeatCount": 2,
				"steps": []map[string]interface{}{
					{
						"id":           "step-1",
						"stepNumber":   1,
						"delayMinutes": 0,
						"targets": []map[string]interface{}{
							{"type": "schedule", "id": "sched-123"},
						},
					},
					{
						"id":           "step-2",
						"stepNumber":   2,
						"delayMinutes": 15,
						"targets": []map[string]interface{}{
							{"type": "user", "id": "user-123"},
						},
					},
				},
				"createdAt": time.Now().Format(time.RFC3339),
				"updatedAt": time.Now().Format(time.RFC3339),
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key")
	policy, err := client.CreateEscalationPolicy(context.Background(), &CreateEscalationPolicyInput{
		Name:        "Default Escalation",
		TeamID:      "team-123",
		RepeatCount: 2,
		Steps: []EscalationStep{
			{
				StepNumber:   1,
				DelayMinutes: 0,
				Targets:      []EscalationTarget{{Type: "schedule", ID: "sched-123"}},
			},
			{
				StepNumber:   2,
				DelayMinutes: 15,
				Targets:      []EscalationTarget{{Type: "user", ID: "user-123"}},
			},
		},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if policy.ID != "ep-123" {
		t.Errorf("expected policy ID ep-123, got %s", policy.ID)
	}
	if len(policy.Steps) != 2 {
		t.Errorf("expected 2 steps, got %d", len(policy.Steps))
	}
	if policy.RepeatCount != 2 {
		t.Errorf("expected repeatCount 2, got %d", policy.RepeatCount)
	}
}

func TestAPIErrorMessage(t *testing.T) {
	err := &APIError{
		Title:  "Not Found",
		Detail: "Resource does not exist",
		Status: 404,
	}

	expected := "Not Found: Resource does not exist"
	if err.Error() != expected {
		t.Errorf("expected %q, got %q", expected, err.Error())
	}

	// Test without detail
	err2 := &APIError{
		Title:  "Internal Server Error",
		Status: 500,
	}
	if err2.Error() != "Internal Server Error" {
		t.Errorf("expected 'Internal Server Error', got %q", err2.Error())
	}
}
