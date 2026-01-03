// Copyright (c) OnCallShift
// SPDX-License-Identifier: MPL-2.0

package resources

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/booldefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
	"github.com/oncallshift/terraform-provider-oncallshift/internal/client"
)

var (
	_ resource.Resource                = &WorkflowResource{}
	_ resource.ResourceWithConfigure   = &WorkflowResource{}
	_ resource.ResourceWithImportState = &WorkflowResource{}
)

type WorkflowResource struct {
	client *client.Client
}

type WorkflowResourceModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	TriggerType types.String `tfsdk:"trigger_type"`
	Enabled     types.Bool   `tfsdk:"enabled"`
}

func NewWorkflowResource() resource.Resource {
	return &WorkflowResource{}
}

func (r *WorkflowResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_workflow"
}

func (r *WorkflowResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages an OnCallShift workflow.",
		MarkdownDescription: `
Manages an OnCallShift workflow.

Workflows automate actions in response to incident events.

## Example Usage

` + "```hcl" + `
resource "oncallshift_workflow" "slack_notify" {
  name         = "Slack Notification"
  description  = "Send Slack message when incident triggers"
  trigger_type = "incident.triggered"
  enabled      = true
}

resource "oncallshift_workflow" "jira_ticket" {
  name         = "Create JIRA Ticket"
  description  = "Create JIRA ticket for high-severity incidents"
  trigger_type = "incident.triggered"
  enabled      = true
}
` + "```" + `

## Trigger Types

- ` + "`incident.triggered`" + ` - When a new incident is created
- ` + "`incident.acknowledged`" + ` - When an incident is acknowledged
- ` + "`incident.resolved`" + ` - When an incident is resolved
- ` + "`incident.escalated`" + ` - When an incident is escalated
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the workflow.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The name of the workflow.",
				Required:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the workflow.",
				Optional:    true,
			},
			"trigger_type": schema.StringAttribute{
				Description: "The event type that triggers this workflow.",
				Required:    true,
			},
			"enabled": schema.BoolAttribute{
				Description: "Whether the workflow is enabled.",
				Optional:    true,
				Computed:    true,
				Default:     booldefault.StaticBool(true),
			},
		},
	}
}

func (r *WorkflowResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}
	client, ok := req.ProviderData.(*client.Client)
	if !ok {
		resp.Diagnostics.AddError("Unexpected Resource Configure Type", fmt.Sprintf("Expected *client.Client, got: %T.", req.ProviderData))
		return
	}
	r.client = client
}

func (r *WorkflowResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan WorkflowResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Creating workflow", map[string]interface{}{"name": plan.Name.ValueString()})

	input := &client.CreateWorkflowInput{
		Name:        plan.Name.ValueString(),
		Description: plan.Description.ValueString(),
		TriggerType: plan.TriggerType.ValueString(),
		Enabled:     plan.Enabled.ValueBool(),
	}

	workflow, err := r.client.CreateWorkflow(ctx, input)
	if err != nil {
		resp.Diagnostics.AddError("Error Creating Workflow", "Could not create workflow: "+err.Error())
		return
	}

	plan.ID = types.StringValue(workflow.ID)

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

func (r *WorkflowResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state WorkflowResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	workflow, err := r.client.GetWorkflow(ctx, state.ID.ValueString())
	if err != nil {
		if apiErr, ok := err.(*client.APIError); ok && apiErr.Status == 404 {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Error Reading Workflow", "Could not read workflow: "+err.Error())
		return
	}

	state.Name = types.StringValue(workflow.Name)
	state.Description = types.StringValue(workflow.Description)
	state.TriggerType = types.StringValue(workflow.TriggerType)
	state.Enabled = types.BoolValue(workflow.Enabled)

	diags = resp.State.Set(ctx, &state)
	resp.Diagnostics.Append(diags...)
}

func (r *WorkflowResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan WorkflowResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state WorkflowResourceModel
	diags = req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	input := &client.CreateWorkflowInput{
		Name:        plan.Name.ValueString(),
		Description: plan.Description.ValueString(),
		TriggerType: plan.TriggerType.ValueString(),
		Enabled:     plan.Enabled.ValueBool(),
	}

	_, err := r.client.UpdateWorkflow(ctx, state.ID.ValueString(), input)
	if err != nil {
		resp.Diagnostics.AddError("Error Updating Workflow", "Could not update workflow: "+err.Error())
		return
	}

	plan.ID = state.ID

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

func (r *WorkflowResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state WorkflowResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	err := r.client.DeleteWorkflow(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error Deleting Workflow", "Could not delete workflow: "+err.Error())
		return
	}
}

func (r *WorkflowResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
