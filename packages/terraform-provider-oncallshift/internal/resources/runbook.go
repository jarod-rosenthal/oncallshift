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

var (
	_ resource.Resource                = &RunbookResource{}
	_ resource.ResourceWithConfigure   = &RunbookResource{}
	_ resource.ResourceWithImportState = &RunbookResource{}
)

type RunbookResource struct {
	client *client.Client
}

type RunbookResourceModel struct {
	ID          types.String `tfsdk:"id"`
	Title       types.String `tfsdk:"title"`
	Description types.String `tfsdk:"description"`
	Content     types.String `tfsdk:"content"`
	ServiceID   types.String `tfsdk:"service_id"`
	Tags        types.List   `tfsdk:"tags"`
}

func NewRunbookResource() resource.Resource {
	return &RunbookResource{}
}

func (r *RunbookResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_runbook"
}

func (r *RunbookResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages an OnCallShift runbook.",
		MarkdownDescription: `
Manages an OnCallShift runbook.

Runbooks document procedures for responding to incidents and can be linked to services.

## Example Usage

` + "```hcl" + `
resource "oncallshift_service" "api" {
  name = "API Service"
}

resource "oncallshift_runbook" "api_outage" {
  title       = "API Outage Response"
  description = "Steps to diagnose and resolve API outages"
  service_id  = oncallshift_service.api.id
  tags        = ["api", "critical", "outage"]

  content = <<-EOT
    # API Outage Response

    ## Initial Assessment
    1. Check service health: https://status.example.com
    2. Review recent deployments
    3. Check database connectivity

    ## Mitigation Steps
    1. If recent deploy: rollback via kubectl rollout undo
    2. If database issue: check connection pool
    3. If traffic spike: scale horizontally

    ## Escalation
    - If unresolved after 15 min, page database team
  EOT
}
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the runbook.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"title": schema.StringAttribute{
				Description: "The title of the runbook.",
				Required:    true,
			},
			"description": schema.StringAttribute{
				Description: "A brief description of the runbook.",
				Optional:    true,
			},
			"content": schema.StringAttribute{
				Description: "The markdown content of the runbook.",
				Optional:    true,
			},
			"service_id": schema.StringAttribute{
				Description: "The ID of the service this runbook is associated with.",
				Optional:    true,
			},
			"tags": schema.ListAttribute{
				Description: "Tags for categorizing the runbook.",
				Optional:    true,
				ElementType: types.StringType,
			},
		},
	}
}

func (r *RunbookResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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

func (r *RunbookResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan RunbookResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Creating runbook", map[string]interface{}{"title": plan.Title.ValueString()})

	var tags []string
	if !plan.Tags.IsNull() {
		diags = plan.Tags.ElementsAs(ctx, &tags, false)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}
	}

	input := &client.CreateRunbookInput{
		Title:       plan.Title.ValueString(),
		Description: plan.Description.ValueString(),
		Content:     plan.Content.ValueString(),
		ServiceID:   plan.ServiceID.ValueString(),
		Tags:        tags,
	}

	runbook, err := r.client.CreateRunbook(ctx, input)
	if err != nil {
		resp.Diagnostics.AddError("Error Creating Runbook", "Could not create runbook: "+err.Error())
		return
	}

	plan.ID = types.StringValue(runbook.ID)

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

func (r *RunbookResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state RunbookResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	runbook, err := r.client.GetRunbook(ctx, state.ID.ValueString())
	if err != nil {
		if apiErr, ok := err.(*client.APIError); ok && apiErr.Status == 404 {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Error Reading Runbook", "Could not read runbook: "+err.Error())
		return
	}

	state.Title = types.StringValue(runbook.Title)
	state.Description = types.StringValue(runbook.Description)
	state.Content = types.StringValue(runbook.Content)
	if runbook.ServiceID != "" {
		state.ServiceID = types.StringValue(runbook.ServiceID)
	}

	diags = resp.State.Set(ctx, &state)
	resp.Diagnostics.Append(diags...)
}

func (r *RunbookResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan RunbookResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state RunbookResourceModel
	diags = req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	var tags []string
	if !plan.Tags.IsNull() {
		diags = plan.Tags.ElementsAs(ctx, &tags, false)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}
	}

	input := &client.CreateRunbookInput{
		Title:       plan.Title.ValueString(),
		Description: plan.Description.ValueString(),
		Content:     plan.Content.ValueString(),
		ServiceID:   plan.ServiceID.ValueString(),
		Tags:        tags,
	}

	_, err := r.client.UpdateRunbook(ctx, state.ID.ValueString(), input)
	if err != nil {
		resp.Diagnostics.AddError("Error Updating Runbook", "Could not update runbook: "+err.Error())
		return
	}

	plan.ID = state.ID

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

func (r *RunbookResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state RunbookResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	err := r.client.DeleteRunbook(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error Deleting Runbook", "Could not delete runbook: "+err.Error())
		return
	}
}

func (r *RunbookResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
