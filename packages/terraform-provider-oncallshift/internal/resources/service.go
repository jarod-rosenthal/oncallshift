// Copyright (c) OnCallShift
// SPDX-License-Identifier: MPL-2.0

package resources

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
	"github.com/oncallshift/terraform-provider-oncallshift/internal/client"
)

// Ensure the implementation satisfies the expected interfaces
var (
	_ resource.Resource                = &ServiceResource{}
	_ resource.ResourceWithConfigure   = &ServiceResource{}
	_ resource.ResourceWithImportState = &ServiceResource{}
)

// ServiceResource is the resource implementation
type ServiceResource struct {
	client *client.Client
}

// ServiceResourceModel describes the resource data model
type ServiceResourceModel struct {
	ID                   types.String `tfsdk:"id"`
	Name                 types.String `tfsdk:"name"`
	Description          types.String `tfsdk:"description"`
	Status               types.String `tfsdk:"status"`
	TeamID               types.String `tfsdk:"team_id"`
	EscalationPolicyID   types.String `tfsdk:"escalation_policy_id"`
	AlertCreationSetting types.String `tfsdk:"alert_creation_setting"`
}

// NewServiceResource returns a new service resource
func NewServiceResource() resource.Resource {
	return &ServiceResource{}
}

// Metadata returns the resource type name
func (r *ServiceResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_service"
}

// Schema defines the schema for the resource
func (r *ServiceResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages an OnCallShift service.",
		MarkdownDescription: `
Manages an OnCallShift service.

Services represent applications, microservices, or infrastructure components that can generate incidents.

## Example Usage

` + "```hcl" + `
resource "oncallshift_team" "platform" {
  name = "Platform Engineering"
}

resource "oncallshift_escalation_policy" "default" {
  name    = "Default Escalation"
  team_id = oncallshift_team.platform.id
}

resource "oncallshift_service" "api" {
  name                 = "API Service"
  description          = "Main API service"
  team_id              = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.default.id
}
` + "```" + `

## Import

Services can be imported using the service ID:

` + "```shell" + `
terraform import oncallshift_service.api 550e8400-e29b-41d4-a716-446655440000
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the service.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The name of the service.",
				Required:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the service.",
				Optional:    true,
			},
			"status": schema.StringAttribute{
				Description: "The status of the service (active, maintenance, disabled).",
				Computed:    true,
			},
			"team_id": schema.StringAttribute{
				Description: "The ID of the team that owns the service.",
				Optional:    true,
			},
			"escalation_policy_id": schema.StringAttribute{
				Description: "The ID of the escalation policy for the service.",
				Optional:    true,
			},
			"alert_creation_setting": schema.StringAttribute{
				Description: "Controls how alerts create incidents. Valid values: create_incidents, create_alerts_and_incidents.",
				Optional:    true,
				Computed:    true,
				Default:     stringdefault.StaticString("create_incidents"),
			},
		},
	}
}

// Configure adds the provider configured client to the resource
func (r *ServiceResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*client.Client)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected Resource Configure Type",
			fmt.Sprintf("Expected *client.Client, got: %T.", req.ProviderData),
		)
		return
	}

	r.client = client
}

// Create creates the resource and sets the initial Terraform state
func (r *ServiceResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan ServiceResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Creating service", map[string]interface{}{
		"name": plan.Name.ValueString(),
	})

	input := &client.CreateServiceInput{
		Name:                 plan.Name.ValueString(),
		Description:          plan.Description.ValueString(),
		TeamID:               plan.TeamID.ValueString(),
		EscalationPolicyID:   plan.EscalationPolicyID.ValueString(),
		AlertCreationSetting: plan.AlertCreationSetting.ValueString(),
	}

	service, err := r.client.CreateService(ctx, input)
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Creating Service",
			"Could not create service: "+err.Error(),
		)
		return
	}

	plan.ID = types.StringValue(service.ID)
	plan.Status = types.StringValue(service.Status)
	if service.AlertCreationSetting != "" {
		plan.AlertCreationSetting = types.StringValue(service.AlertCreationSetting)
	}

	tflog.Info(ctx, "Created service", map[string]interface{}{
		"id":   service.ID,
		"name": service.Name,
	})

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

// Read refreshes the Terraform state with the latest data
func (r *ServiceResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state ServiceResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Reading service", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	service, err := r.client.GetService(ctx, state.ID.ValueString())
	if err != nil {
		if apiErr, ok := err.(*client.APIError); ok && apiErr.Status == 404 {
			tflog.Warn(ctx, "Service not found, removing from state", map[string]interface{}{
				"id": state.ID.ValueString(),
			})
			resp.State.RemoveResource(ctx)
			return
		}

		resp.Diagnostics.AddError(
			"Error Reading Service",
			"Could not read service ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	state.Name = types.StringValue(service.Name)
	state.Description = types.StringValue(service.Description)
	state.Status = types.StringValue(service.Status)
	if service.TeamID != "" {
		state.TeamID = types.StringValue(service.TeamID)
	}
	if service.EscalationPolicyID != "" {
		state.EscalationPolicyID = types.StringValue(service.EscalationPolicyID)
	}
	if service.AlertCreationSetting != "" {
		state.AlertCreationSetting = types.StringValue(service.AlertCreationSetting)
	}

	diags = resp.State.Set(ctx, &state)
	resp.Diagnostics.Append(diags...)
}

// Update updates the resource and sets the updated Terraform state
func (r *ServiceResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan ServiceResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state ServiceResourceModel
	diags = req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Updating service", map[string]interface{}{
		"id":   state.ID.ValueString(),
		"name": plan.Name.ValueString(),
	})

	input := &client.CreateServiceInput{
		Name:                 plan.Name.ValueString(),
		Description:          plan.Description.ValueString(),
		TeamID:               plan.TeamID.ValueString(),
		EscalationPolicyID:   plan.EscalationPolicyID.ValueString(),
		AlertCreationSetting: plan.AlertCreationSetting.ValueString(),
	}

	service, err := r.client.UpdateService(ctx, state.ID.ValueString(), input)
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Updating Service",
			"Could not update service ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	plan.ID = state.ID
	plan.Status = types.StringValue(service.Status)

	tflog.Info(ctx, "Updated service", map[string]interface{}{
		"id":   service.ID,
		"name": service.Name,
	})

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

// Delete deletes the resource
func (r *ServiceResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state ServiceResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Deleting service", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	err := r.client.DeleteService(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Deleting Service",
			"Could not delete service ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	tflog.Info(ctx, "Deleted service", map[string]interface{}{
		"id": state.ID.ValueString(),
	})
}

// ImportState imports an existing resource
func (r *ServiceResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
