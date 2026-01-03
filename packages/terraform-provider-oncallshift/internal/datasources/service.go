// Copyright (c) OnCallShift
// SPDX-License-Identifier: MPL-2.0

package datasources

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
	"github.com/oncallshift/terraform-provider-oncallshift/internal/client"
)

// Ensure the implementation satisfies the expected interfaces
var _ datasource.DataSource = &ServiceDataSource{}
var _ datasource.DataSourceWithConfigure = &ServiceDataSource{}

// ServiceDataSource is the data source implementation
type ServiceDataSource struct {
	client *client.Client
}

// ServiceDataSourceModel describes the data source data model
type ServiceDataSourceModel struct {
	ID                   types.String `tfsdk:"id"`
	Name                 types.String `tfsdk:"name"`
	Description          types.String `tfsdk:"description"`
	Status               types.String `tfsdk:"status"`
	TeamID               types.String `tfsdk:"team_id"`
	EscalationPolicyID   types.String `tfsdk:"escalation_policy_id"`
	AlertCreationSetting types.String `tfsdk:"alert_creation_setting"`
}

// NewServiceDataSource returns a new service data source
func NewServiceDataSource() datasource.DataSource {
	return &ServiceDataSource{}
}

// Metadata returns the data source type name
func (d *ServiceDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_service"
}

// Schema defines the schema for the data source
func (d *ServiceDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Fetches information about an existing OnCallShift service.",
		MarkdownDescription: `
Fetches information about an existing OnCallShift service.

## Example Usage

` + "```hcl" + `
data "oncallshift_service" "api" {
  id = "550e8400-e29b-41d4-a716-446655440000"
}

output "service_status" {
  value = data.oncallshift_service.api.status
}
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the service.",
				Required:    true,
			},
			"name": schema.StringAttribute{
				Description: "The name of the service.",
				Computed:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the service.",
				Computed:    true,
			},
			"status": schema.StringAttribute{
				Description: "The status of the service.",
				Computed:    true,
			},
			"team_id": schema.StringAttribute{
				Description: "The ID of the team that owns the service.",
				Computed:    true,
			},
			"escalation_policy_id": schema.StringAttribute{
				Description: "The ID of the escalation policy for the service.",
				Computed:    true,
			},
			"alert_creation_setting": schema.StringAttribute{
				Description: "Controls how alerts create incidents.",
				Computed:    true,
			},
		},
	}
}

// Configure adds the provider configured client to the data source
func (d *ServiceDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	client, ok := req.ProviderData.(*client.Client)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected Data Source Configure Type",
			fmt.Sprintf("Expected *client.Client, got: %T.", req.ProviderData),
		)
		return
	}

	d.client = client
}

// Read refreshes the Terraform state with the latest data
func (d *ServiceDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var state ServiceDataSourceModel
	diags := req.Config.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Reading service data source", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	service, err := d.client.GetService(ctx, state.ID.ValueString())
	if err != nil {
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
