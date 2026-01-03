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
	_ resource.Resource                = &UserResource{}
	_ resource.ResourceWithConfigure   = &UserResource{}
	_ resource.ResourceWithImportState = &UserResource{}
)

// UserResource is the resource implementation
type UserResource struct {
	client *client.Client
}

// UserResourceModel describes the resource data model
type UserResourceModel struct {
	ID       types.String `tfsdk:"id"`
	Email    types.String `tfsdk:"email"`
	FullName types.String `tfsdk:"full_name"`
	Role     types.String `tfsdk:"role"`
	Phone    types.String `tfsdk:"phone"`
	Timezone types.String `tfsdk:"timezone"`
	JobTitle types.String `tfsdk:"job_title"`
	TeamIDs  types.List   `tfsdk:"team_ids"`
}

// NewUserResource returns a new user resource
func NewUserResource() resource.Resource {
	return &UserResource{}
}

// Metadata returns the resource type name
func (r *UserResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_user"
}

// Schema defines the schema for the resource
func (r *UserResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages an OnCallShift user.",
		MarkdownDescription: `
Manages an OnCallShift user.

Users are invited to OnCallShift and can be assigned to teams, schedules, and escalation policies.

## Example Usage

` + "```hcl" + `
resource "oncallshift_team" "platform" {
  name = "Platform Engineering"
}

resource "oncallshift_user" "alice" {
  email     = "alice@example.com"
  full_name = "Alice Smith"
  role      = "user"
  timezone  = "America/New_York"
  team_ids  = [oncallshift_team.platform.id]
}
` + "```" + `

## Import

Users can be imported using the user ID:

` + "```shell" + `
terraform import oncallshift_user.alice 550e8400-e29b-41d4-a716-446655440000
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the user.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"email": schema.StringAttribute{
				Description: "The email address of the user.",
				Required:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"full_name": schema.StringAttribute{
				Description: "The full name of the user.",
				Required:    true,
			},
			"role": schema.StringAttribute{
				Description: "The role of the user (admin, user).",
				Optional:    true,
				Computed:    true,
				Default:     stringdefault.StaticString("user"),
			},
			"phone": schema.StringAttribute{
				Description: "The phone number of the user.",
				Optional:    true,
			},
			"timezone": schema.StringAttribute{
				Description: "The timezone of the user (e.g., America/New_York).",
				Optional:    true,
				Computed:    true,
				Default:     stringdefault.StaticString("UTC"),
			},
			"job_title": schema.StringAttribute{
				Description: "The job title of the user.",
				Optional:    true,
			},
			"team_ids": schema.ListAttribute{
				Description: "The IDs of teams the user belongs to.",
				Optional:    true,
				ElementType: types.StringType,
			},
		},
	}
}

// Configure adds the provider configured client to the resource
func (r *UserResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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
func (r *UserResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan UserResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Creating user", map[string]interface{}{
		"email": plan.Email.ValueString(),
	})

	// Extract team IDs from list
	var teamIDs []string
	if !plan.TeamIDs.IsNull() {
		diags = plan.TeamIDs.ElementsAs(ctx, &teamIDs, false)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}
	}

	input := &client.CreateUserInput{
		Email:    plan.Email.ValueString(),
		FullName: plan.FullName.ValueString(),
		Role:     plan.Role.ValueString(),
		TeamIDs:  teamIDs,
	}

	user, err := r.client.CreateUser(ctx, input)
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Creating User",
			"Could not invite user: "+err.Error(),
		)
		return
	}

	plan.ID = types.StringValue(user.ID)
	if user.Role != "" {
		plan.Role = types.StringValue(user.Role)
	}
	if user.Timezone != "" {
		plan.Timezone = types.StringValue(user.Timezone)
	}

	tflog.Info(ctx, "Created user", map[string]interface{}{
		"id":    user.ID,
		"email": user.Email,
	})

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

// Read refreshes the Terraform state with the latest data
func (r *UserResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state UserResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Reading user", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	user, err := r.client.GetUser(ctx, state.ID.ValueString())
	if err != nil {
		if apiErr, ok := err.(*client.APIError); ok && apiErr.Status == 404 {
			tflog.Warn(ctx, "User not found, removing from state", map[string]interface{}{
				"id": state.ID.ValueString(),
			})
			resp.State.RemoveResource(ctx)
			return
		}

		resp.Diagnostics.AddError(
			"Error Reading User",
			"Could not read user ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	state.Email = types.StringValue(user.Email)
	state.FullName = types.StringValue(user.FullName)
	if user.Role != "" {
		state.Role = types.StringValue(user.Role)
	}
	if user.Phone != "" {
		state.Phone = types.StringValue(user.Phone)
	}
	if user.Timezone != "" {
		state.Timezone = types.StringValue(user.Timezone)
	}
	if user.JobTitle != "" {
		state.JobTitle = types.StringValue(user.JobTitle)
	}

	diags = resp.State.Set(ctx, &state)
	resp.Diagnostics.Append(diags...)
}

// Update updates the resource and sets the updated Terraform state
func (r *UserResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan UserResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state UserResourceModel
	diags = req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Updating user", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	input := &client.UpdateUserInput{
		FullName: plan.FullName.ValueString(),
		Role:     plan.Role.ValueString(),
		Phone:    plan.Phone.ValueString(),
		Timezone: plan.Timezone.ValueString(),
		JobTitle: plan.JobTitle.ValueString(),
	}

	user, err := r.client.UpdateUser(ctx, state.ID.ValueString(), input)
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Updating User",
			"Could not update user ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	plan.ID = state.ID
	plan.Email = state.Email // Email can't be changed

	tflog.Info(ctx, "Updated user", map[string]interface{}{
		"id":    user.ID,
		"email": user.Email,
	})

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

// Delete deletes the resource
func (r *UserResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state UserResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Deleting user", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	err := r.client.DeleteUser(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Deleting User",
			"Could not delete user ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	tflog.Info(ctx, "Deleted user", map[string]interface{}{
		"id": state.ID.ValueString(),
	})
}

// ImportState imports an existing resource
func (r *UserResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
