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
var _ datasource.DataSource = &ScheduleDataSource{}
var _ datasource.DataSourceWithConfigure = &ScheduleDataSource{}

// ScheduleDataSource is the data source implementation
type ScheduleDataSource struct {
	client *client.Client
}

// ScheduleDataSourceModel describes the data source data model
type ScheduleDataSourceModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Timezone    types.String `tfsdk:"timezone"`
	TeamID      types.String `tfsdk:"team_id"`
}

// NewScheduleDataSource returns a new schedule data source
func NewScheduleDataSource() datasource.DataSource {
	return &ScheduleDataSource{}
}

// Metadata returns the data source type name
func (d *ScheduleDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_schedule"
}

// Schema defines the schema for the data source
func (d *ScheduleDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Fetches information about an existing OnCallShift schedule.",
		MarkdownDescription: `
Fetches information about an existing OnCallShift schedule.

## Example Usage

` + "```hcl" + `
data "oncallshift_schedule" "primary" {
  id = "550e8400-e29b-41d4-a716-446655440000"
}

output "schedule_timezone" {
  value = data.oncallshift_schedule.primary.timezone
}
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the schedule.",
				Required:    true,
			},
			"name": schema.StringAttribute{
				Description: "The name of the schedule.",
				Computed:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the schedule.",
				Computed:    true,
			},
			"timezone": schema.StringAttribute{
				Description: "The timezone of the schedule.",
				Computed:    true,
			},
			"team_id": schema.StringAttribute{
				Description: "The ID of the team that owns the schedule.",
				Computed:    true,
			},
		},
	}
}

// Configure adds the provider configured client to the data source
func (d *ScheduleDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
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
func (d *ScheduleDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var state ScheduleDataSourceModel
	diags := req.Config.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Reading schedule data source", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	schedule, err := d.client.GetSchedule(ctx, state.ID.ValueString())
	if err != nil {
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
