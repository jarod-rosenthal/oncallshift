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
var _ datasource.DataSource = &UserDataSource{}
var _ datasource.DataSourceWithConfigure = &UserDataSource{}

// UserDataSource is the data source implementation
type UserDataSource struct {
	client *client.Client
}

// UserDataSourceModel describes the data source data model
type UserDataSourceModel struct {
	ID       types.String `tfsdk:"id"`
	Email    types.String `tfsdk:"email"`
	FullName types.String `tfsdk:"full_name"`
	Role     types.String `tfsdk:"role"`
	Phone    types.String `tfsdk:"phone"`
	Timezone types.String `tfsdk:"timezone"`
	JobTitle types.String `tfsdk:"job_title"`
}

// NewUserDataSource returns a new user data source
func NewUserDataSource() datasource.DataSource {
	return &UserDataSource{}
}

// Metadata returns the data source type name
func (d *UserDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_user"
}

// Schema defines the schema for the data source
func (d *UserDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Fetches information about an existing OnCallShift user.",
		MarkdownDescription: `
Fetches information about an existing OnCallShift user.

## Example Usage

` + "```hcl" + `
data "oncallshift_user" "alice" {
  id = "550e8400-e29b-41d4-a716-446655440000"
}

output "user_email" {
  value = data.oncallshift_user.alice.email
}
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the user.",
				Required:    true,
			},
			"email": schema.StringAttribute{
				Description: "The email address of the user.",
				Computed:    true,
			},
			"full_name": schema.StringAttribute{
				Description: "The full name of the user.",
				Computed:    true,
			},
			"role": schema.StringAttribute{
				Description: "The role of the user.",
				Computed:    true,
			},
			"phone": schema.StringAttribute{
				Description: "The phone number of the user.",
				Computed:    true,
			},
			"timezone": schema.StringAttribute{
				Description: "The timezone of the user.",
				Computed:    true,
			},
			"job_title": schema.StringAttribute{
				Description: "The job title of the user.",
				Computed:    true,
			},
		},
	}
}

// Configure adds the provider configured client to the data source
func (d *UserDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
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
func (d *UserDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var state UserDataSourceModel
	diags := req.Config.Get(ctx, &state)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	tflog.Debug(ctx, "Reading user data source", map[string]interface{}{
		"id": state.ID.ValueString(),
	})

	user, err := d.client.GetUser(ctx, state.ID.ValueString())
	if err != nil {
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
