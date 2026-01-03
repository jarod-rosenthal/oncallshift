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
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64default"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
	"github.com/oncallshift/terraform-provider-oncallshift/internal/client"
)

// Ensure the implementation satisfies the expected interfaces
var (
	_ resource.Resource                = &EscalationPolicyResource{}
	_ resource.ResourceWithConfigure   = &EscalationPolicyResource{}
	_ resource.ResourceWithImportState = &EscalationPolicyResource{}
)

// EscalationPolicyResource is the resource implementation
type EscalationPolicyResource struct {
	client *client.Client
}

// EscalationPolicyResourceModel describes the resource data model
type EscalationPolicyResourceModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	TeamID      types.String `tfsdk:"team_id"`
	RepeatCount types.Int64  `tfsdk:"repeat_count"`
	Steps       types.List   `tfsdk:"step"`
}

// EscalationStepModel describes an escalation step
type EscalationStepModel struct {
	ID           types.String `tfsdk:"id"`
	StepNumber   types.Int64  `tfsdk:"step_number"`
	DelayMinutes types.Int64  `tfsdk:"delay_minutes"`
	Targets      types.List   `tfsdk:"target"`
}

// EscalationTargetModel describes a target within a step
type EscalationTargetModel struct {
	Type types.String `tfsdk:"type"`
	ID   types.String `tfsdk:"id"`
}

// NewEscalationPolicyResource returns a new escalation policy resource
func NewEscalationPolicyResource() resource.Resource {
	return &EscalationPolicyResource{}
}

// Metadata returns the resource type name
func (r *EscalationPolicyResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_escalation_policy"
}

// Schema defines the schema for the resource
func (r *EscalationPolicyResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages an OnCallShift escalation policy.",
		MarkdownDescription: `
Manages an OnCallShift escalation policy.

Escalation policies define how incidents are escalated through a series of steps until acknowledged or resolved.

## Example Usage

` + "```hcl" + `
resource "oncallshift_team" "platform" {
  name = "Platform Engineering"
}

resource "oncallshift_schedule" "primary" {
  name     = "Primary On-Call"
  timezone = "America/New_York"
  team_id  = oncallshift_team.platform.id
}

resource "oncallshift_user" "manager" {
  email     = "manager@example.com"
  full_name = "Team Manager"
}

resource "oncallshift_escalation_policy" "default" {
  name         = "Default Escalation"
  description  = "Default escalation policy for platform services"
  team_id      = oncallshift_team.platform.id
  repeat_count = 2

  step {
    step_number   = 1
    delay_minutes = 0

    target {
      type = "schedule"
      id   = oncallshift_schedule.primary.id
    }
  }

  step {
    step_number   = 2
    delay_minutes = 15

    target {
      type = "user"
      id   = oncallshift_user.manager.id
    }
  }
}
` + "```" + `

## Import

Escalation policies can be imported using the policy ID:

` + "```shell" + `
terraform import oncallshift_escalation_policy.default 550e8400-e29b-41d4-a716-446655440000
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the escalation policy.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The name of the escalation policy.",
				Required:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the escalation policy.",
				Optional:    true,
			},
			"team_id": schema.StringAttribute{
				Description: "The ID of the team that owns the escalation policy.",
				Optional:    true,
			},
			"repeat_count": schema.Int64Attribute{
				Description: "The number of times to repeat the escalation steps if no one responds.",
				Optional:    true,
				Computed:    true,
				Default:     int64default.StaticInt64(0),
			},
		},
		Blocks: map[string]schema.Block{
			"step": schema.ListNestedBlock{
				Description: "Escalation steps define the order and timing of notifications.",
				NestedObject: schema.NestedBlockObject{
					Attributes: map[string]schema.Attribute{
						"id": schema.StringAttribute{
							Description: "The unique identifier of the step.",
							Computed:    true,
						},
						"step_number": schema.Int64Attribute{
							Description: "The order of the step in the escalation (1-based).",
							Required:    true,
						},
						"delay_minutes": schema.Int64Attribute{
							Description: "Minutes to wait before escalating to this step.",
							Required:    true,
						},
					},
					Blocks: map[string]schema.Block{
						"target": schema.ListNestedBlock{
							Description: "Targets to notify at this step.",
							NestedObject: schema.NestedBlockObject{
								Attributes: map[string]schema.Attribute{
									"type": schema.StringAttribute{
										Description: "The type of target (user, schedule, team).",
										Required:    true,
									},
									"id": schema.StringAttribute{
										Description: "The ID of the target (user ID, schedule ID, or team ID).",
										Required:    true,
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

// Configure adds the provider configured client to the resource
func (r *EscalationPolicyResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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
func (r *EscalationPolicyResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan EscalationPolicyResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Creating escalation policy", map[string]interface{}{
		"name": plan.Name.ValueString(),
	})

	// Convert steps from Terraform model to API model
	var steps []client.EscalationStep
	if !plan.Steps.IsNull() {
		var stepModels []EscalationStepModel
		diags = plan.Steps.ElementsAs(ctx, &stepModels, false)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}

		for _, sm := range stepModels {
			var targets []client.EscalationTarget
			if !sm.Targets.IsNull() {
				var targetModels []EscalationTargetModel
				diags = sm.Targets.ElementsAs(ctx, &targetModels, false)
				resp.Diagnostics.Append(diags...)
				if resp.Diagnostics.HasError() {
					return
				}

				for _, tm := range targetModels {
					targets = append(targets, client.EscalationTarget{
						Type: tm.Type.ValueString(),
						ID:   tm.ID.ValueString(),
					})
				}
			}

			steps = append(steps, client.EscalationStep{
				StepNumber:   int(sm.StepNumber.ValueInt64()),
				DelayMinutes: int(sm.DelayMinutes.ValueInt64()),
				Targets:      targets,
			})
		}
	}

	input := &client.CreateEscalationPolicyInput{
		Name:        plan.Name.ValueString(),
		Description: plan.Description.ValueString(),
		TeamID:      plan.TeamID.ValueString(),
		RepeatCount: int(plan.RepeatCount.ValueInt64()),
		Steps:       steps,
	}

	policy, err := r.client.CreateEscalationPolicy(ctx, input)
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Creating Escalation Policy",
			"Could not create escalation policy: "+err.Error(),
		)
		return
	}

	plan.ID = types.StringValue(policy.ID)

	// Update steps with their IDs
	if len(policy.Steps) > 0 {
		targetType := types.ObjectType{
			AttrTypes: map[string]attr.Type{
				"type": types.StringType,
				"id":   types.StringType,
			},
		}

		stepType := types.ObjectType{
			AttrTypes: map[string]attr.Type{
				"id":            types.StringType,
				"step_number":   types.Int64Type,
				"delay_minutes": types.Int64Type,
				"target":        types.ListType{ElemType: targetType},
			},
		}

		var stepValues []attr.Value
		for _, s := range policy.Steps {
			var targetValues []attr.Value
			for _, t := range s.Targets {
				targetObj, _ := types.ObjectValue(targetType.AttrTypes, map[string]attr.Value{
					"type": types.StringValue(t.Type),
					"id":   types.StringValue(t.ID),
				})
				targetValues = append(targetValues, targetObj)
			}
			targetsList, _ := types.ListValue(targetType, targetValues)

			stepObj, _ := types.ObjectValue(stepType.AttrTypes, map[string]attr.Value{
				"id":            types.StringValue(s.ID),
				"step_number":   types.Int64Value(int64(s.StepNumber)),
				"delay_minutes": types.Int64Value(int64(s.DelayMinutes)),
				"target":        targetsList,
			})
			stepValues = append(stepValues, stepObj)
		}

		plan.Steps, _ = types.ListValue(stepType, stepValues)
	}

	tflog.Info(ctx, "Created escalation policy", map[string]interface{}{
		"id":   policy.ID,
		"name": policy.Name,
	})

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

// Read refreshes the Terraform state
func (r *EscalationPolicyResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state EscalationPolicyResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Reading escalation policy", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	policy, err := r.client.GetEscalationPolicy(ctx, state.ID.ValueString())
	if err != nil {
		if apiErr, ok := err.(*client.APIError); ok && apiErr.Status == 404 {
			tflog.Warn(ctx, "Escalation policy not found, removing from state", map[string]interface{}{
				"id": state.ID.ValueString(),
			})
			resp.State.RemoveResource(ctx)
			return
		}

		resp.Diagnostics.AddError(
			"Error Reading Escalation Policy",
			"Could not read escalation policy ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	state.Name = types.StringValue(policy.Name)
	state.Description = types.StringValue(policy.Description)
	if policy.TeamID != "" {
		state.TeamID = types.StringValue(policy.TeamID)
	}
	state.RepeatCount = types.Int64Value(int64(policy.RepeatCount))

	diags = resp.State.Set(ctx, &state)
	resp.Diagnostics.Append(diags...)
}

// Update updates the resource
func (r *EscalationPolicyResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan EscalationPolicyResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state EscalationPolicyResourceModel
	diags = req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Updating escalation policy", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	// Convert steps
	var steps []client.EscalationStep
	if !plan.Steps.IsNull() {
		var stepModels []EscalationStepModel
		diags = plan.Steps.ElementsAs(ctx, &stepModels, false)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}

		for _, sm := range stepModels {
			var targets []client.EscalationTarget
			if !sm.Targets.IsNull() {
				var targetModels []EscalationTargetModel
				diags = sm.Targets.ElementsAs(ctx, &targetModels, false)
				resp.Diagnostics.Append(diags...)
				if resp.Diagnostics.HasError() {
					return
				}

				for _, tm := range targetModels {
					targets = append(targets, client.EscalationTarget{
						Type: tm.Type.ValueString(),
						ID:   tm.ID.ValueString(),
					})
				}
			}

			steps = append(steps, client.EscalationStep{
				ID:           sm.ID.ValueString(),
				StepNumber:   int(sm.StepNumber.ValueInt64()),
				DelayMinutes: int(sm.DelayMinutes.ValueInt64()),
				Targets:      targets,
			})
		}
	}

	input := &client.CreateEscalationPolicyInput{
		Name:        plan.Name.ValueString(),
		Description: plan.Description.ValueString(),
		TeamID:      plan.TeamID.ValueString(),
		RepeatCount: int(plan.RepeatCount.ValueInt64()),
		Steps:       steps,
	}

	policy, err := r.client.UpdateEscalationPolicy(ctx, state.ID.ValueString(), input)
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Updating Escalation Policy",
			"Could not update escalation policy ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	plan.ID = state.ID

	tflog.Info(ctx, "Updated escalation policy", map[string]interface{}{
		"id":   policy.ID,
		"name": policy.Name,
	})

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

// Delete deletes the resource
func (r *EscalationPolicyResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state EscalationPolicyResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Deleting escalation policy", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	err := r.client.DeleteEscalationPolicy(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError(
			"Error Deleting Escalation Policy",
			"Could not delete escalation policy ID "+state.ID.ValueString()+": "+err.Error(),
		)
		return
	}

	tflog.Info(ctx, "Deleted escalation policy", map[string]interface{}{
		"id": state.ID.ValueString(),
	})
}

// ImportState imports an existing resource
func (r *EscalationPolicyResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
