// Copyright (c) OnCallShift
// SPDX-License-Identifier: MPL-2.0

package resources

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/attr"
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
	_ resource.Resource                = &ScheduleResource{}
	_ resource.ResourceWithConfigure   = &ScheduleResource{}
	_ resource.ResourceWithImportState = &ScheduleResource{}
)

// ScheduleResource is the resource implementation
type ScheduleResource struct {
	client *client.Client
}

// ScheduleResourceModel describes the resource data model
type ScheduleResourceModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Timezone    types.String `tfsdk:"timezone"`
	TeamID      types.String `tfsdk:"team_id"`
	Layers      types.List   `tfsdk:"layer"`
}

// ScheduleLayerModel describes a schedule layer
type ScheduleLayerModel struct {
	ID                   types.String `tfsdk:"id"`
	Name                 types.String `tfsdk:"name"`
	Start                types.String `tfsdk:"start"`
	RotationVirtualStart types.String `tfsdk:"rotation_virtual_start"`
	RotationTurnLength   types.Int64  `tfsdk:"rotation_turn_length_seconds"`
	Users                types.List   `tfsdk:"users"`
}

// NewScheduleResource returns a new schedule resource
func NewScheduleResource() resource.Resource {
	return &ScheduleResource{}
}

// Metadata returns the resource type name
func (r *ScheduleResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_schedule"
}

// Schema defines the schema for the resource
func (r *ScheduleResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages an OnCallShift schedule.",
		MarkdownDescription: `
Manages an OnCallShift schedule.

Schedules define on-call rotations for teams. They can have multiple layers with different rotation patterns.

## Example Usage

` + "```hcl" + `
resource "oncallshift_team" "platform" {
  name = "Platform Engineering"
}

resource "oncallshift_user" "alice" {
  email     = "alice@example.com"
  full_name = "Alice Smith"
}

resource "oncallshift_user" "bob" {
  email     = "bob@example.com"
  full_name = "Bob Jones"
}

resource "oncallshift_schedule" "primary" {
  name        = "Primary On-Call"
  description = "Primary on-call rotation"
  timezone    = "America/New_York"
  team_id     = oncallshift_team.platform.id

  layer {
    name                        = "Layer 1"
    start                       = "2024-01-01T00:00:00Z"
    rotation_turn_length_seconds = 604800  # 1 week
    users                       = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
    ]
  }
}
` + "```" + `

## Import

Schedules can be imported using the schedule ID:

` + "```shell" + `
terraform import oncallshift_schedule.primary 550e8400-e29b-41d4-a716-446655440000
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the schedule.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The name of the schedule.",
				Required:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the schedule.",
				Optional:    true,
			},
			"timezone": schema.StringAttribute{
				Description: "The timezone for the schedule (e.g., America/New_York).",
				Optional:    true,
				Computed:    true,
				Default:     stringdefault.StaticString("UTC"),
			},
			"team_id": schema.StringAttribute{
				Description: "The ID of the team that owns the schedule.",
				Optional:    true,
			},
		},
		Blocks: map[string]schema.Block{
			"layer": schema.ListNestedBlock{
				Description: "Schedule layers define rotation patterns.",
				NestedObject: schema.NestedBlockObject{
					Attributes: map[string]schema.Attribute{
						"id": schema.StringAttribute{
							Description: "The unique identifier of the layer.",
							Computed:    true,
						},
						"name": schema.StringAttribute{
							Description: "The name of the layer.",
							Required:    true,
						},
						"start": schema.StringAttribute{
							Description: "The start time for the layer (ISO 8601 format).",
							Required:    true,
						},
						"rotation_virtual_start": schema.StringAttribute{
							Description: "The virtual start time for rotation calculations.",
							Optional:    true,
						},
						"rotation_turn_length_seconds": schema.Int64Attribute{
							Description: "The length of each rotation turn in seconds.",
							Required:    true,
						},
						"users": schema.ListAttribute{
							Description: "The user IDs in the rotation.",
							Required:    true,
							ElementType: types.StringType,
						},
					},
				},
			},
		},
	}
}

// Configure adds the provider configured client to the resource
func (r *ScheduleResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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

// Create creates the resource
func (r *ScheduleResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan ScheduleResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Creating schedule", map[string]interface{}{
		"name": plan.Name.ValueString(),
	})

	// Convert layers from Terraform model to API model
	var layers []client.ScheduleLayer
	if !plan.Layers.IsNull() {
		var layerModels []ScheduleLayerModel
		diags = plan.Layers.ElementsAs(ctx, &layerModels, false)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}

		for _, lm := range layerModels {
			var users []string
			diags = lm.Users.ElementsAs(ctx, &users, false)
			resp.Diagnostics.Append(diags...)
			if resp.Diagnostics.HasError() {
				return
			}

			layers = append(layers, client.ScheduleLayer{
				Name:                 lm.Name.ValueString(),
				Start:                lm.Start.ValueString(),
				RotationVirtualStart: lm.RotationVirtualStart.ValueString(),
				RotationTurnLength:   int(lm.RotationTurnLength.ValueInt64()),
				Users:                users,
			})
		}
	}

	input := &client.CreateScheduleInput{
		Name:        plan.Name.ValueString(),
		Description: plan.Description.ValueString(),
		Timezone:    plan.Timezone.ValueString(),
		TeamID:      plan.TeamID.ValueString(),
		Layers:      layers,
	}

	schedule, err := r.client.CreateSchedule(ctx, input)
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Creating Schedule",
			"Could not create schedule: "+err.Error(),
		)
		return
	}

	plan.ID = types.StringValue(schedule.ID)
	if schedule.Timezone != "" {
		plan.Timezone = types.StringValue(schedule.Timezone)
	}

	// Update layers with their IDs
	if len(schedule.Layers) > 0 {
		layerType := types.ObjectType{
			AttrTypes: map[string]attr.Type{
				"id":                           types.StringType,
				"name":                         types.StringType,
				"start":                        types.StringType,
				"rotation_virtual_start":       types.StringType,
				"rotation_turn_length_seconds": types.Int64Type,
				"users":                        types.ListType{ElemType: types.StringType},
			},
		}

		var layerValues []attr.Value
		for i, l := range schedule.Layers {
			userValues := make([]attr.Value, len(l.Users))
			for j, u := range l.Users {
				userValues[j] = types.StringValue(u)
			}
			usersList, _ := types.ListValue(types.StringType, userValues)

			layerObj, _ := types.ObjectValue(layerType.AttrTypes, map[string]attr.Value{
				"id":                           types.StringValue(l.ID),
				"name":                         types.StringValue(l.Name),
				"start":                        types.StringValue(l.Start),
				"rotation_virtual_start":       types.StringValue(l.RotationVirtualStart),
				"rotation_turn_length_seconds": types.Int64Value(int64(l.RotationTurnLength)),
				"users":                        usersList,
			})
			_ = i
			layerValues = append(layerValues, layerObj)
		}

		plan.Layers, _ = types.ListValue(layerType, layerValues)
	}

	tflog.Info(ctx, "Created schedule", map[string]interface{}{
		"id":   schedule.ID,
		"name": schedule.Name,
	})

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

// Read refreshes the Terraform state
func (r *ScheduleResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state ScheduleResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Reading schedule", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	schedule, err := r.client.GetSchedule(ctx, state.ID.ValueString())
	if err != nil {
		if apiErr, ok := err.(*client.APIError); ok && apiErr.Status == 404 {
			tflog.Warn(ctx, "Schedule not found, removing from state", map[string]interface{}{
				"id": state.ID.ValueString(),
			})
			resp.State.RemoveResource(ctx)
			return
		}

		resp.Diagnostics.AddError(
			"Error Reading Schedule",
			"Could not read schedule ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	state.Name = types.StringValue(schedule.Name)
	state.Description = types.StringValue(schedule.Description)
	state.Timezone = types.StringValue(schedule.Timezone)
	if schedule.TeamID != "" {
		state.TeamID = types.StringValue(schedule.TeamID)
	}

	diags = resp.State.Set(ctx, &state)
	resp.Diagnostics.Append(diags...)
}

// Update updates the resource
func (r *ScheduleResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan ScheduleResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state ScheduleResourceModel
	diags = req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Updating schedule", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	// Convert layers
	var layers []client.ScheduleLayer
	if !plan.Layers.IsNull() {
		var layerModels []ScheduleLayerModel
		diags = plan.Layers.ElementsAs(ctx, &layerModels, false)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}

		for _, lm := range layerModels {
			var users []string
			diags = lm.Users.ElementsAs(ctx, &users, false)
			resp.Diagnostics.Append(diags...)
			if resp.Diagnostics.HasError() {
				return
			}

			layers = append(layers, client.ScheduleLayer{
				ID:                   lm.ID.ValueString(),
				Name:                 lm.Name.ValueString(),
				Start:                lm.Start.ValueString(),
				RotationVirtualStart: lm.RotationVirtualStart.ValueString(),
				RotationTurnLength:   int(lm.RotationTurnLength.ValueInt64()),
				Users:                users,
			})
		}
	}

	input := &client.CreateScheduleInput{
		Name:        plan.Name.ValueString(),
		Description: plan.Description.ValueString(),
		Timezone:    plan.Timezone.ValueString(),
		TeamID:      plan.TeamID.ValueString(),
		Layers:      layers,
	}

	schedule, err := r.client.UpdateSchedule(ctx, state.ID.ValueString(), input)
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Updating Schedule",
			"Could not update schedule ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	plan.ID = state.ID

	tflog.Info(ctx, "Updated schedule", map[string]interface{}{
		"id":   schedule.ID,
		"name": schedule.Name,
	})

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

// Delete deletes the resource
func (r *ScheduleResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state ScheduleResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Deleting schedule", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	err := r.client.DeleteSchedule(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Deleting Schedule",
			"Could not delete schedule ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	tflog.Info(ctx, "Deleted schedule", map[string]interface{}{
		"id": state.ID.ValueString(),
	})
}

// ImportState imports an existing resource
func (r *ScheduleResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
