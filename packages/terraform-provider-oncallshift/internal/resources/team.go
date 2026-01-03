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
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
	"github.com/oncallshift/terraform-provider-oncallshift/internal/client"
)

// Ensure the implementation satisfies the expected interfaces
var (
	_ resource.Resource                = &TeamResource{}
	_ resource.ResourceWithConfigure   = &TeamResource{}
	_ resource.ResourceWithImportState = &TeamResource{}
)

// TeamResource is the resource implementation
type TeamResource struct {
	client *client.Client
}

// TeamResourceModel describes the resource data model
type TeamResourceModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Slug        types.String `tfsdk:"slug"`
}

// NewTeamResource returns a new team resource
func NewTeamResource() resource.Resource {
	return &TeamResource{}
}

// Metadata returns the resource type name
func (r *TeamResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_team"
}

// Schema defines the schema for the resource
func (r *TeamResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages an OnCallShift team.",
		MarkdownDescription: `
Manages an OnCallShift team.

Teams are the primary organizational unit in OnCallShift. Services, schedules, and escalation policies are associated with teams.

## Example Usage

` + "```hcl" + `
resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  description = "Infrastructure and platform team"
}

resource "oncallshift_team" "backend" {
  name        = "Backend"
  description = "Backend services team"
}
` + "```" + `

## Import

Teams can be imported using the team ID:

` + "```shell" + `
terraform import oncallshift_team.platform 550e8400-e29b-41d4-a716-446655440000
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the team.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The name of the team.",
				Required:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the team.",
				Optional:    true,
			},
			"slug": schema.StringAttribute{
				Description: "The URL-friendly slug of the team.",
				Computed:    true,
			},
		},
	}
}

// Configure adds the provider configured client to the resource
func (r *TeamResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*client.Client)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected Resource Configure Type",
			fmt.Sprintf("Expected *client.Client, got: %T. Please report this issue to the provider developers.", req.ProviderData),
		)
		return
	}

	r.client = client
}

// Create creates the resource and sets the initial Terraform state
func (r *TeamResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan TeamResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Creating team", map[string]interface{}{
		"name": plan.Name.ValueString(),
	})

	team, err := r.client.CreateTeam(ctx, plan.Name.ValueString(), plan.Description.ValueString())
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Creating Team",
			"Could not create team, unexpected error: "+err.Error(),
		)
		return
	}

	plan.ID = types.StringValue(team.ID)
	plan.Slug = types.StringValue(team.Slug)

	tflog.Info(ctx, "Created team", map[string]interface{}{
		"id":   team.ID,
		"name": team.Name,
	})

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

// Read refreshes the Terraform state with the latest data
func (r *TeamResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state TeamResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Reading team", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	team, err := r.client.GetTeam(ctx, state.ID.ValueString())
	if err != nil {
		// Check if the resource no longer exists
		if apiErr, ok := err.(*client.APIError); ok && apiErr.Status == 404 {
			tflog.Warn(ctx, "Team not found, removing from state", map[string]interface{}{
				"id": state.ID.ValueString(),
			})
			resp.State.RemoveResource(ctx)
			return
		}

		resp.Diagnostics.AddError(
			"Error Reading Team",
			"Could not read team ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	state.Name = types.StringValue(team.Name)
	state.Description = types.StringValue(team.Description)
	state.Slug = types.StringValue(team.Slug)

	diags = resp.State.Set(ctx, &state)
	resp.Diagnostics.Append(diags...)
}

// Update updates the resource and sets the updated Terraform state
func (r *TeamResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan TeamResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state TeamResourceModel
	diags = req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Updating team", map[string]interface{}{
		"id":   state.ID.ValueString(),
		"name": plan.Name.ValueString(),
	})

	team, err := r.client.UpdateTeam(ctx, state.ID.ValueString(), plan.Name.ValueString(), plan.Description.ValueString())
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Updating Team",
			"Could not update team ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	plan.ID = state.ID
	plan.Slug = types.StringValue(team.Slug)

	tflog.Info(ctx, "Updated team", map[string]interface{}{
		"id":   team.ID,
		"name": team.Name,
	})

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

// Delete deletes the resource and removes the Terraform state
func (r *TeamResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state TeamResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Deleting team", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	err := r.client.DeleteTeam(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Deleting Team",
			"Could not delete team ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	tflog.Info(ctx, "Deleted team", map[string]interface{}{
		"id": state.ID.ValueString(),
	})
}

// ImportState imports an existing resource into Terraform
func (r *TeamResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
