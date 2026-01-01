import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { cloudCredentialsAPI } from '../lib/api-client';
import type { CloudCredential, CloudProvider, CloudAccessLog } from '../types/api';
import { Cloud, Plus, Trash2, Eye, EyeOff, RefreshCw, CheckCircle, XCircle, Shield, Clock, AlertTriangle } from 'lucide-react';

const PROVIDER_INFO: Record<CloudProvider, { name: string; color: string; icon: string }> = {
  aws: { name: 'Amazon Web Services', color: 'bg-orange-500', icon: 'AWS' },
  azure: { name: 'Microsoft Azure', color: 'bg-blue-500', icon: 'Azure' },
  gcp: { name: 'Google Cloud Platform', color: 'bg-red-500', icon: 'GCP' },
  anthropic: { name: 'Anthropic (Claude AI)', color: 'bg-amber-600', icon: 'AI' },
};

const AWS_SERVICES = ['ec2', 'ecs', 'lambda', 'rds', 's3', 'cloudwatch', 'cloudtrail', 'dynamodb', 'elasticache', 'sns', 'sqs'];
const AZURE_SERVICES = ['virtual-machines', 'app-service', 'functions', 'sql-database', 'cosmos-db', 'storage', 'monitor', 'key-vault'];
const GCP_SERVICES = ['compute', 'cloud-run', 'cloud-functions', 'cloud-sql', 'firestore', 'storage', 'logging', 'monitoring'];

export function CloudCredentials() {
  const [isLoading, setIsLoading] = useState(true);
  const [credentials, setCredentials] = useState<CloudCredential[]>([]);
  const [accessLogs, setAccessLogs] = useState<CloudAccessLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<CloudCredential | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Form states
  const [formProvider, setFormProvider] = useState<CloudProvider>('aws');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissionLevel, setFormPermissionLevel] = useState<'read_only' | 'read_write'>('read_only');
  const [formAllowedServices, setFormAllowedServices] = useState<string[]>([]);
  const [formMaxDuration, setFormMaxDuration] = useState(60);
  const [formRequireApproval, setFormRequireApproval] = useState(true);

  // Provider-specific credential fields
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsRoleArn, setAwsRoleArn] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [awsExternalId, setAwsExternalId] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);

  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureSubscriptionId, setAzureSubscriptionId] = useState('');

  const [gcpServiceAccountJson, setGcpServiceAccountJson] = useState('');
  const [gcpProjectId, setGcpProjectId] = useState('');

  // Anthropic
  const [anthropicApiKey, setAnthropicApiKey] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setIsLoading(true);
      const response = await cloudCredentialsAPI.list();
      setCredentials(response?.credentials || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load cloud credentials');
      setCredentials([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccessLogs = async (credentialId?: string) => {
    try {
      const response = await cloudCredentialsAPI.getAccessLogs({ credential_id: credentialId, limit: 50 });
      setAccessLogs(response?.logs || []);
    } catch (err: any) {
      console.error('Failed to load access logs:', err);
      setAccessLogs([]);
    }
  };

  const handleTest = async (id: string) => {
    try {
      setTestingId(id);
      setTestResult(null);
      const result = await cloudCredentialsAPI.test(id);
      setTestResult({ id, success: result.success, message: result.message });
    } catch (err: any) {
      setTestResult({ id, success: false, message: err.response?.data?.error || 'Test failed' });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential? This action cannot be undone.')) {
      return;
    }
    try {
      await cloudCredentialsAPI.delete(id);
      setSuccess('Credential deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      loadCredentials();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete credential');
    }
  };

  const handleToggleEnabled = async (credential: CloudCredential) => {
    try {
      await cloudCredentialsAPI.update(credential.id, { enabled: !credential.enabled });
      setSuccess(`Credential ${credential.enabled ? 'disabled' : 'enabled'} successfully`);
      setTimeout(() => setSuccess(null), 3000);
      loadCredentials();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update credential');
    }
  };

  const resetForm = () => {
    setFormProvider('aws');
    setFormName('');
    setFormDescription('');
    setFormPermissionLevel('read_only');
    setFormAllowedServices([]);
    setFormMaxDuration(60);
    setFormRequireApproval(true);
    setAwsAccessKeyId('');
    setAwsSecretAccessKey('');
    setAwsRoleArn('');
    setAwsRegion('us-east-1');
    setAwsExternalId('');
    setAzureClientId('');
    setAzureClientSecret('');
    setAzureTenantId('');
    setAzureSubscriptionId('');
    setGcpServiceAccountJson('');
    setGcpProjectId('');
    setAnthropicApiKey('');
    setShowSecrets(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      let credentials: Record<string, any> = {};

      if (formProvider === 'aws') {
        credentials = {
          aws_region: awsRegion,
        };
        if (awsRoleArn) {
          credentials.aws_role_arn = awsRoleArn;
          if (awsExternalId) credentials.external_id = awsExternalId;
        } else {
          credentials.aws_access_key_id = awsAccessKeyId;
          credentials.aws_secret_access_key = awsSecretAccessKey;
        }
      } else if (formProvider === 'azure') {
        credentials = {
          client_id: azureClientId,
          client_secret: azureClientSecret,
          tenant_id: azureTenantId,
          subscription_id: azureSubscriptionId,
        };
      } else if (formProvider === 'gcp') {
        credentials = {
          service_account_json: gcpServiceAccountJson,
          project_id: gcpProjectId,
        };
      } else if (formProvider === 'anthropic') {
        credentials = {
          api_key: anthropicApiKey,
        };
      }

      await cloudCredentialsAPI.create({
        provider: formProvider,
        name: formName,
        description: formDescription || undefined,
        credentials,
        permission_level: formPermissionLevel,
        allowed_services: formAllowedServices.length > 0 ? formAllowedServices : undefined,
        max_session_duration_minutes: formMaxDuration,
        require_approval_for_write: formRequireApproval,
      });

      setSuccess('Cloud credential created successfully');
      setTimeout(() => setSuccess(null), 3000);
      setShowAddModal(false);
      resetForm();
      loadCredentials();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create credential');
    } finally {
      setIsSaving(false);
    }
  };

  const getServicesForProvider = (provider: CloudProvider) => {
    switch (provider) {
      case 'aws': return AWS_SERVICES;
      case 'azure': return AZURE_SERVICES;
      case 'gcp': return GCP_SERVICES;
      case 'anthropic': return []; // AI provider, no services
    }
  };

  const toggleService = (service: string) => {
    setFormAllowedServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Cloud className="w-8 h-8" />
            Cloud Credentials
          </h2>
          <p className="text-muted-foreground">
            Manage cloud provider credentials for AI-powered incident investigation
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Credential
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500 rounded-lg text-green-600">
          {success}
        </div>
      )}

      {/* Security Notice */}
      <Card className="mb-6 border-yellow-500/50 bg-yellow-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-yellow-600">
            <Shield className="w-5 h-5" />
            Security Notice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cloud credentials are encrypted at rest using AES-256-GCM with per-organization key isolation.
            For production use, we recommend using IAM roles (AWS) or service principals (Azure/GCP) with
            minimal required permissions. All access is logged for audit purposes.
          </p>
        </CardContent>
      </Card>

      {/* Credentials List */}
      {credentials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Cloud Credentials</h3>
            <p className="text-muted-foreground mb-4">
              Add cloud credentials to enable AI-powered incident investigation
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Credential
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {credentials.map((credential) => (
            <Card key={credential.id} className={!credential.enabled ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${PROVIDER_INFO[credential.provider].color} rounded-lg flex items-center justify-center text-white font-bold`}>
                      {PROVIDER_INFO[credential.provider].icon}
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {credential.name}
                        {!credential.enabled && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">Disabled</span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {PROVIDER_INFO[credential.provider].name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Stats */}
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {credential.usage_count} uses
                      </div>
                      {credential.last_used_at && (
                        <div className="text-xs">
                          Last: {new Date(credential.last_used_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Permission badge */}
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      credential.permission_level === 'read_only'
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-orange-500/10 text-orange-600'
                    }`}>
                      {credential.permission_level === 'read_only' ? 'Read Only' : 'Read/Write'}
                    </div>

                    {/* Test result */}
                    {testResult?.id === credential.id && (
                      <div className={`flex items-center gap-1 text-sm ${testResult.success ? 'text-green-600' : 'text-destructive'}`}>
                        {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {testResult.success ? 'Connected' : 'Failed'}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(credential.id)}
                        disabled={testingId === credential.id}
                      >
                        {testingId === credential.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleEnabled(credential)}
                      >
                        {credential.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCredential(credential);
                          loadAccessLogs(credential.id);
                          setShowLogsModal(true);
                        }}
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(credential.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Allowed services */}
                {credential.allowed_services.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-xs text-muted-foreground mr-2">Allowed services:</span>
                    <div className="inline-flex flex-wrap gap-1">
                      {credential.allowed_services.map((service) => (
                        <span key={service} className="px-2 py-0.5 bg-muted rounded text-xs">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Credential Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold">Add Cloud Credential</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure cloud provider access for AI incident investigation
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>Provider</Label>
                <div className="grid grid-cols-4 gap-3">
                  {(['aws', 'azure', 'gcp', 'anthropic'] as CloudProvider[]).map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => {
                        setFormProvider(provider);
                        setFormAllowedServices([]);
                      }}
                      className={`p-4 border rounded-lg text-center transition-colors ${
                        formProvider === provider
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className={`w-10 h-10 ${PROVIDER_INFO[provider].color} rounded-lg flex items-center justify-center text-white font-bold mx-auto mb-2`}>
                        {PROVIDER_INFO[provider].icon}
                      </div>
                      <span className="text-sm font-medium">{PROVIDER_INFO[provider].name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Production AWS Account"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g., Main production environment"
                  />
                </div>
              </div>

              {/* Provider-specific credentials */}
              {formProvider === 'aws' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">AWS Credentials</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSecrets(!showSecrets)}
                    >
                      {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="awsRegion">Region</Label>
                    <Input
                      id="awsRegion"
                      value={awsRegion}
                      onChange={(e) => setAwsRegion(e.target.value)}
                      placeholder="us-east-1"
                      required
                    />
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Choose authentication method: IAM Role (recommended) or Access Keys
                    </p>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="awsRoleArn">IAM Role ARN (recommended)</Label>
                        <Input
                          id="awsRoleArn"
                          value={awsRoleArn}
                          onChange={(e) => setAwsRoleArn(e.target.value)}
                          placeholder="arn:aws:iam::123456789012:role/OnCallShiftRole"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="awsExternalId">External ID (for role assumption)</Label>
                        <Input
                          id="awsExternalId"
                          value={awsExternalId}
                          onChange={(e) => setAwsExternalId(e.target.value)}
                          placeholder="Optional external ID"
                        />
                      </div>
                    </div>

                    <div className="my-4 flex items-center gap-4">
                      <div className="flex-1 border-t"></div>
                      <span className="text-xs text-muted-foreground">OR</span>
                      <div className="flex-1 border-t"></div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="awsAccessKeyId">Access Key ID</Label>
                        <Input
                          id="awsAccessKeyId"
                          value={awsAccessKeyId}
                          onChange={(e) => setAwsAccessKeyId(e.target.value)}
                          placeholder="AKIA..."
                          type={showSecrets ? 'text' : 'password'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="awsSecretAccessKey">Secret Access Key</Label>
                        <Input
                          id="awsSecretAccessKey"
                          value={awsSecretAccessKey}
                          onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                          placeholder="Secret key"
                          type={showSecrets ? 'text' : 'password'}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formProvider === 'azure' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Azure Service Principal</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSecrets(!showSecrets)}
                    >
                      {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="azureClientId">Client ID</Label>
                      <Input
                        id="azureClientId"
                        value={azureClientId}
                        onChange={(e) => setAzureClientId(e.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000000"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="azureClientSecret">Client Secret</Label>
                      <Input
                        id="azureClientSecret"
                        value={azureClientSecret}
                        onChange={(e) => setAzureClientSecret(e.target.value)}
                        type={showSecrets ? 'text' : 'password'}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="azureTenantId">Tenant ID</Label>
                      <Input
                        id="azureTenantId"
                        value={azureTenantId}
                        onChange={(e) => setAzureTenantId(e.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000000"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="azureSubscriptionId">Subscription ID</Label>
                      <Input
                        id="azureSubscriptionId"
                        value={azureSubscriptionId}
                        onChange={(e) => setAzureSubscriptionId(e.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000000"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {formProvider === 'gcp' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">GCP Service Account</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSecrets(!showSecrets)}
                    >
                      {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gcpProjectId">Project ID</Label>
                      <Input
                        id="gcpProjectId"
                        value={gcpProjectId}
                        onChange={(e) => setGcpProjectId(e.target.value)}
                        placeholder="my-project-123456"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gcpServiceAccountJson">Service Account Key JSON</Label>
                      <textarea
                        id="gcpServiceAccountJson"
                        value={gcpServiceAccountJson}
                        onChange={(e) => setGcpServiceAccountJson(e.target.value)}
                        className="w-full h-32 px-3 py-2 border rounded-md font-mono text-sm"
                        placeholder='{"type": "service_account", ...}'
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {formProvider === 'anthropic' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Anthropic API Key</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSecrets(!showSecrets)}
                    >
                      {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter your Anthropic API key to enable AI-powered incident analysis.
                    Get your key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">console.anthropic.com</a>
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="anthropicApiKey">API Key</Label>
                    <Input
                      id="anthropicApiKey"
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                      type={showSecrets ? 'text' : 'password'}
                      placeholder="sk-ant-api03-..."
                      required
                    />
                  </div>
                </div>
              )}

              {/* Access Control - hide for Anthropic */}
              {formProvider !== 'anthropic' && (
              <div className="space-y-4">
                <h4 className="font-medium">Access Control</h4>

                <div className="space-y-2">
                  <Label>Permission Level</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formPermissionLevel === 'read_only'}
                        onChange={() => setFormPermissionLevel('read_only')}
                      />
                      <span className="text-sm">Read Only (recommended)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formPermissionLevel === 'read_write'}
                        onChange={() => setFormPermissionLevel('read_write')}
                      />
                      <span className="text-sm">Read/Write</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Allowed Services (leave empty for all)</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30 max-h-32 overflow-y-auto">
                    {getServicesForProvider(formProvider).map((service) => (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          formAllowedServices.includes(service)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {service}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxDuration">Max Session Duration (minutes)</Label>
                    <Input
                      id="maxDuration"
                      type="number"
                      min={5}
                      max={480}
                      value={formMaxDuration}
                      onChange={(e) => setFormMaxDuration(parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Write Operations</Label>
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={formRequireApproval}
                        onChange={(e) => setFormRequireApproval(e.target.checked)}
                      />
                      <span className="text-sm">Require approval for write operations</span>
                    </label>
                  </div>
                </div>
              </div>
              )}

              {/* Warning */}
              {formPermissionLevel === 'read_write' && formProvider !== 'anthropic' && (
                <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium">Read/Write access warning</p>
                    <p className="mt-1">
                      This allows the AI to make changes to your cloud resources.
                      Ensure you have proper approval workflows in place.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Creating...' : 'Create Credential'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access Logs Modal */}
      {showLogsModal && selectedCredential && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Access Logs</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedCredential.name} - {PROVIDER_INFO[selectedCredential.provider].name}
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowLogsModal(false)}>
                Close
              </Button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {accessLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No access logs yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {accessLogs.map((log) => (
                    <Card key={log.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{log.user?.full_name || 'Unknown'}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              log.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                              log.status === 'failed' ? 'bg-red-500/10 text-red-600' :
                              'bg-yellow-500/10 text-yellow-600'
                            }`}>
                              {log.status}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(log.session_start).toLocaleString()}
                          </span>
                        </div>

                        {log.commands_executed.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-1">Commands executed:</p>
                            <div className="bg-muted rounded p-2 font-mono text-xs">
                              {log.commands_executed.map((cmd, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className={cmd.result === 'success' ? 'text-green-600' : 'text-red-600'}>
                                    {cmd.result === 'success' ? '✓' : '✗'}
                                  </span>
                                  <span>{cmd.command}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {log.findings.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-1">Findings:</p>
                            <ul className="text-sm list-disc list-inside">
                              {log.findings.map((finding, i) => (
                                <li key={i}>{finding}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
