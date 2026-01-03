// Copyright (c) OnCallShift
// SPDX-License-Identifier: MPL-2.0

package provider

import (
	"context"
	"os"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/provider/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/hashicorp/terraform-plugin-log/tflog"
	"github.com/oncallshift/terraform-provider-oncallshift/internal/client"
	"github.com/oncallshift/terraform-provider-oncallshift/internal/datasources"
	"github.com/oncallshift/terraform-provider-oncallshift/internal/resources"
)

// Ensure the implementation satisfies the expected interfaces
var _ provider.Provider = &OnCallShiftProvider{}

// OnCallShiftProvider defines the provider implementation
type OnCallShiftProvider struct {
	version string
}

// OnCallShiftProviderModel describes the provider data model
type OnCallShiftProviderModel struct {
	APIURL types.String `tfsdk:"api_url"`
	APIKey types.String `tfsdk:"api_key"`
}

// New returns a new provider instance
func New(version string) func() provider.Provider {
	return func() provider.Provider {
		return &OnCallShiftProvider{
			version: version,
		}
	}
}

// Metadata returns the provider type name
func (p *OnCallShiftProvider) Metadata(_ context.Context, _ provider.MetadataRequest, resp *provider.MetadataResponse) {
	resp.TypeName = "oncallshift"
	resp.Version = p.version
}

// Schema defines the provider-level schema for configuration data
func (p *OnCallShiftProvider) Schema(_ context.Context, _ provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "The OnCallShift provider allows you to manage OnCallShift resources using Terraform.",
		MarkdownDescription: `
The OnCallShift provider allows you to manage your incident management infrastructure as code.

## Authentication

The provider supports API key authentication. You can configure the API key in the provider block or using the ` + "`ONCALLSHIFT_API_KEY`" + ` environment variable.

## Example Usage

` + "```hcl" + `
provider "oncallshift" {
  api_key = var.oncallshift_api_key
}

resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  description = "Infrastructure and platform team"
}

resource "oncallshift_service" "api" {
  name        = "API Service"
  team_id     = oncallshift_team.platform.id
}
` + "```" + `
`,
		Attributes: map[string]schema.Attribute{
			"api_url": schema.StringAttribute{
				Description: "The base URL of the OnCallShift API. Defaults to https://oncallshift.com/api/v1. Can also be set via ONCALLSHIFT_API_URL environment variable.",
				Optional:    true,
			},
			"api_key": schema.StringAttribute{
				Description: "The API key for authenticating with OnCallShift. Can also be set via ONCALLSHIFT_API_KEY environment variable.",
				Optional:    true,
				Sensitive:   true,
			},
		},
	}
}

// Configure prepares an API client for data sources and resources
func (p *OnCallShiftProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	tflog.Info(ctx, "Configuring OnCallShift provider")

	// Retrieve provider data from configuration
	var config OnCallShiftProviderModel
	diags := req.Config.Get(ctx, &config)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}

	// Default values from environment variables
	apiURL := os.Getenv("ONCALLSHIFT_API_URL")
	apiKey := os.Getenv("ONCALLSHIFT_API_KEY")

	// Override with configuration values if provided
	if !config.APIURL.IsNull() {
		apiURL = config.APIURL.ValueString()
	}
	if !config.APIKey.IsNull() {
		apiKey = config.APIKey.ValueString()
	}

	// Set default API URL if not provided
	if apiURL == "" {
		apiURL = "https://oncallshift.com/api/v1"
	}

	// Validate configuration
	if apiKey == "" {
		resp.Diagnostics.AddAttributeError(
			path.Root("api_key"),
			"Missing OnCallShift API Key",
			"The provider cannot create the OnCallShift API client as there is a missing or empty value for the OnCallShift API key. "+
				"Set the api_key value in the configuration or use the ONCALLSHIFT_API_KEY environment variable. "+
				"If either is already set, ensure the value is not empty.",
		)
		return
	}

	tflog.Debug(ctx, "Creating OnCallShift client", map[string]interface{}{
		"api_url": apiURL,
	})

	// Create API client
	apiClient := client.NewClient(apiURL, apiKey)

	// Make the client available to resources and data sources
	resp.DataSourceData = apiClient
	resp.ResourceData = apiClient

	tflog.Info(ctx, "Configured OnCallShift provider", map[string]interface{}{
		"api_url": apiURL,
	})
}

// Resources defines the resources implemented in the provider
func (p *OnCallShiftProvider) Resources(_ context.Context) []func() resource.Resource {
	return []func() resource.Resource{
		resources.NewTeamResource,
		resources.NewServiceResource,
		resources.NewUserResource,
		resources.NewScheduleResource,
		resources.NewEscalationPolicyResource,
		resources.NewIntegrationResource,
		resources.NewRoutingRuleResource,
		resources.NewRunbookResource,
		resources.NewWorkflowResource,
	}
}

// DataSources defines the data sources implemented in the provider
func (p *OnCallShiftProvider) DataSources(_ context.Context) []func() datasource.DataSource {
	return []func() datasource.DataSource{
		datasources.NewTeamDataSource,
		datasources.NewServiceDataSource,
		datasources.NewUserDataSource,
		datasources.NewScheduleDataSource,
	}
}
