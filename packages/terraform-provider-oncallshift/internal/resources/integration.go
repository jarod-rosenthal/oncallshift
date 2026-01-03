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
	_ resource.Resource                = &IntegrationResource{}
	_ resource.ResourceWithConfigure   = &IntegrationResource{}
	_ resource.ResourceWithImportState = &IntegrationResource{}
)

type IntegrationResource struct {
	client *client.Client
}

type IntegrationResourceModel struct {
	ID             types.String `tfsdk:"id"`
	Name           types.String `tfsdk:"name"`
	Type           types.String `tfsdk:"type"`
	ServiceID      types.String `tfsdk:"service_id"`
	IntegrationKey types.String `tfsdk:"integration_key"`
	Enabled        types.Bool   `tfsdk:"enabled"`
}

func NewIntegrationResource() resource.Resource {
	return &IntegrationResource{}
}

func (r *IntegrationResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_integration"
}

func (r *IntegrationResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages an OnCallShift integration.",
		MarkdownDescription: `
Manages an OnCallShift integration.

Integrations connect external monitoring tools to OnCallShift services for alert ingestion.

## Example Usage

` + "```hcl" + `
resource "oncallshift_service" "api" {
  name = "API Service"
}

resource "oncallshift_integration" "datadog" {
  name       = "Datadog Integration"
  type       = "datadog"
  service_id = oncallshift_service.api.id
  enabled    = true
}

output "webhook_url" {
  value = "https://oncallshift.com/api/v1/webhooks/${oncallshift_integration.datadog.integration_key}"
}
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the integration.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The name of the integration.",
				Required:    true,
			},
			"type": schema.StringAttribute{
				Description: "The type of integration (generic, datadog, cloudwatch, prometheus, etc.).",
				Required:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"service_id": schema.StringAttribute{
				Description: "The ID of the service this integration belongs to.",
				Required:    true,
			},
			"integration_key": schema.StringAttribute{
				Description: "The integration key for webhook URLs.",
				Computed:    true,
				Sensitive:   true,
			},
			"enabled": schema.BoolAttribute{
				Description: "Whether the integration is enabled.",
				Optional:    true,
				Computed:    true,
				Default:     booldefault.StaticBool(true),
			},
		},
	}
}

func (r *IntegrationResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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

func (r *IntegrationResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan IntegrationResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Creating integration", map[string]interface{}{"name": plan.Name.ValueString()})

	input := &client.CreateIntegrationInput{
		Name:      plan.Name.ValueString(),
		Type:      plan.Type.ValueString(),
		ServiceID: plan.ServiceID.ValueString(),
		Enabled:   plan.Enabled.ValueBool(),
	}

	integration, err := r.client.CreateIntegration(ctx, input)
	if err != nil {
		resp.Diagnostics.AddError("Error Creating Integration", "Could not create integration: "+err.Error())
		return
	}

	plan.ID = types.StringValue(integration.ID)
	plan.IntegrationKey = types.StringValue(integration.IntegrationKey)

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

func (r *IntegrationResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state IntegrationResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	integration, err := r.client.GetIntegration(ctx, state.ID.ValueString())
	if err != nil {
		if apiErr, ok := err.(*client.APIError); ok && apiErr.Status == 404 {
			resp.State.RemoveResource(ctx)
			return
		}
		resp.Diagnostics.AddError("Error Reading Integration", "Could not read integration: "+err.Error())
		return
	}

	state.Name = types.StringValue(integration.Name)
	state.Type = types.StringValue(integration.Type)
	state.ServiceID = types.StringValue(integration.ServiceID)
	state.IntegrationKey = types.StringValue(integration.IntegrationKey)
	state.Enabled = types.BoolValue(integration.Enabled)

	diags = resp.State.Set(ctx, &state)
	resp.Diagnostics.Append(diags...)
}

func (r *IntegrationResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan IntegrationResourceModel
	diags := req.Plan.Get(ctx, &plan)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state IntegrationResourceModel
	diags = req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	input := &client.CreateIntegrationInput{
		Name:      plan.Name.ValueString(),
		Type:      plan.Type.ValueString(),
		ServiceID: plan.ServiceID.ValueString(),
		Enabled:   plan.Enabled.ValueBool(),
	}

	integration, err := r.client.UpdateIntegration(ctx, state.ID.ValueString(), input)
	if err != nil {
		resp.Diagnostics.AddError("Error Updating Integration", "Could not update integration: "+err.Error())
		return
	}

	plan.ID = state.ID
	plan.IntegrationKey = types.StringValue(integration.IntegrationKey)

	diags = resp.State.Set(ctx, plan)
	resp.Diagnostics.Append(diags...)
}

func (r *IntegrationResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state IntegrationResourceModel
	diags := req.State.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	err := r.client.DeleteIntegration(ctx, state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error Deleting Integration", "Could not delete integration: "+err.Error())
		return
	}
}

func (r *IntegrationResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
