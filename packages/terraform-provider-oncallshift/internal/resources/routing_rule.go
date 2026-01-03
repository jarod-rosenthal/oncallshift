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
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64default"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
	"github.com/oncallshift/terraform-provider-oncallshift/internal/client"
)

var (
	_ resource.Resource                = &RoutingRuleResource{}
	_ resource.ResourceWithConfigure   = &RoutingRuleResource{}
	_ resource.ResourceWithImportState = &RoutingRuleResource{}
)

type RoutingRuleResource struct {
	client *client.Client
}

type RoutingRuleResourceModel struct {
	ID              types.String `tfsdk:"id"`
	Name            types.String `tfsdk:"name"`
	Description     types.String `tfsdk:"description"`
	Conditions      types.String `tfsdk:"conditions"`
	TargetServiceID types.String `tfsdk:"target_service_id"`
	RuleOrder       types.Int64  `tfsdk:"rule_order"`
	Enabled         types.Bool   `tfsdk:"enabled"`
}

func NewRoutingRuleResource() resource.Resource {
	return &RoutingRuleResource{}
}

func (r *RoutingRuleResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_routing_rule"
}

func (r *RoutingRuleResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages an OnCallShift routing rule.",
		MarkdownDescription: `
Manages an OnCallShift routing rule.

Routing rules determine how incoming alerts are routed to services based on conditions.

## Example Usage

` + "```hcl" + `
resource "oncallshift_service" "api" {
  name = "API Service"
}

resource "oncallshift_service" "database" {
  name = "Database Service"
}

resource "oncallshift_routing_rule" "database_alerts" {
  name              = "Database Alerts"
  description       = "Route database alerts to database service"
  target_service_id = oncallshift_service.database.id
  rule_order        = 1
  enabled           = true
  conditions        = jsonencode({
    all = [
      { field = "source", operator = "contains", value = "postgres" }
    ]
  })
}
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the routing rule.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The name of the routing rule.",
				Required:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the routing rule.",
				Optional:    true,
			},
			"conditions": schema.StringAttribute{
				Description: "JSON-encoded conditions for matching alerts.",
				Optional:    true,
			},
			"target_service_id": schema.StringAttribute{
				Description: "The ID of the service to route matching alerts to.",
				Required:    true,
			},
			"rule_order": schema.Int64Attribute{
				Description: "The order of the rule (lower numbers are evaluated first).",
				Optional:    true,
				Computed:    true,
				Default:     int64default.StaticInt64(0),
			},
			"enabled": schema.BoolAttribute{
				Description: "Whether the routing rule is enabled.",
				Optional:    true,
				Computed:    true,
				Default:     booldefault.StaticBool(true),
			},
		},
	}
}

func (r *RoutingRuleResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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

func (r *RoutingRuleResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan RoutingRuleResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Creating routing rule", map[string]interface{}{"name": plan.Name.ValueString()})

	input := &client.CreateRoutingRuleInput{
		Name:            plan.Name.ValueString(),
		Description:     plan.Description.ValueString(),
		Conditions:      plan.Conditions.ValueString(),
		TargetServiceID: plan.TargetServiceID.ValueString(),
		RuleOrder:       int(plan.RuleOrder.ValueInt64()),
		Enabled:         plan.Enabled.ValueBool(),
	}

	rule, err := r.client.CreateRoutingRule(ctx, input)
	if err != nil {
		resp.Diagnostics.AddError("Error Creating Routing Rule", "Could not create routing rule: "+err.Error())
		return
	}

	plan.ID = types.StringValue(rule.ID)

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

func (r *RoutingRuleResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state RoutingRuleResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	rule, err := r.client.GetRoutingRule(ctx, state.ID.ValueString())
	if err != nil {
		if apiErr, ok := err.(*client.APIError); ok && apiErr.Status == 404 {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Error Reading Routing Rule", "Could not read routing rule: "+err.Error())
		return
	}

	state.Name = types.StringValue(rule.Name)
	state.Description = types.StringValue(rule.Description)
	state.Conditions = types.StringValue(rule.Conditions)
	state.TargetServiceID = types.StringValue(rule.TargetServiceID)
	state.RuleOrder = types.Int64Value(int64(rule.RuleOrder))
	state.Enabled = types.BoolValue(rule.Enabled)

	diags = resp.State.Set(ctx, &state)
	resp.Diagnostics.Append(diags...)
}

func (r *RoutingRuleResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan RoutingRuleResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state RoutingRuleResourceModel
	diags = req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	input := &client.CreateRoutingRuleInput{
		Name:            plan.Name.ValueString(),
		Description:     plan.Description.ValueString(),
		Conditions:      plan.Conditions.ValueString(),
		TargetServiceID: plan.TargetServiceID.ValueString(),
		RuleOrder:       int(plan.RuleOrder.ValueInt64()),
		Enabled:         plan.Enabled.ValueBool(),
	}

	_, err := r.client.UpdateRoutingRule(ctx, state.ID.ValueString(), input)
	if err != nil {
		resp.Diagnostics.AddError("Error Updating Routing Rule", "Could not update routing rule: "+err.Error())
		return
	}

	plan.ID = state.ID

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

func (r *RoutingRuleResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state RoutingRuleResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	err := r.client.DeleteRoutingRule(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error Deleting Routing Rule", "Could not delete routing rule: "+err.Error())
		return
	}
}

func (r *RoutingRuleResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
