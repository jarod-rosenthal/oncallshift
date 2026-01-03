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
var _ datasource.DataSource = &TeamDataSource{}
var _ datasource.DataSourceWithConfigure = &TeamDataSource{}

// TeamDataSource is the data source implementation
type TeamDataSource struct {
	client *client.Client
}

// TeamDataSourceModel describes the data source data model
type TeamDataSourceModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Slug        types.String `tfsdk:"slug"`
}

// NewTeamDataSource returns a new team data source
func NewTeamDataSource() datasource.DataSource {
	return &TeamDataSource{}
}

// Metadata returns the data source type name
func (d *TeamDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_team"
}

// Schema defines the schema for the data source
func (d *TeamDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Fetches information about an existing OnCallShift team.",
		MarkdownDescription: `
Fetches information about an existing OnCallShift team.

Use this data source to look up a team by its ID and access its attributes.

## Example Usage

` + "```hcl" + `
data "oncallshift_team" "platform" {
  id = "550e8400-e29b-41d4-a716-446655440000"
}

output "team_name" {
  value = data.oncallshift_team.platform.name
}
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the team.",
				Required:    true,
			},
			"name": schema.StringAttribute{
				Description: "The name of the team.",
				Computed:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the team.",
				Computed:    true,
			},
			"slug": schema.StringAttribute{
				Description: "The URL-friendly slug of the team.",
				Computed:    true,
			},
		},
	}
}

// Configure adds the provider configured client to the data source
func (d *TeamDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
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
func (d *TeamDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var state TeamDataSourceModel
	diags := req.Config.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Reading team data source", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	team, err := d.client.GetTeam(ctx, state.ID.ValueString())
	if err != nil {
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
