import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { aiConfigAPI, type AIConfigResponse, type AIProviderInfo } from '../lib/api-client';
import { Bot, Check, AlertTriangle, Info, Sparkles } from 'lucide-react';

type AIProvider = 'anthropic' | 'openai' | 'google';

const PROVIDER_INFO: Record<AIProvider, { name: string; color: string; description: string }> = {
  anthropic: {
    name: 'Anthropic (Claude)',
    color: 'bg-amber-600',
    description: 'Claude models for chat, analysis, and code generation',
  },
  openai: {
    name: 'OpenAI (GPT)',
    color: 'bg-emerald-600',
    description: 'GPT models for versatile AI capabilities',
  },
  google: {
    name: 'Google (Gemini)',
    color: 'bg-blue-600',
    description: 'Gemini models for multimodal AI tasks',
  },
};

export function AISettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<AIConfigResponse | null>(null);
  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [defaultProvider, setDefaultProvider] = useState<AIProvider>('anthropic');
  const [enableFallback, setEnableFallback] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [configRes, providersRes] = await Promise.all([
        aiConfigAPI.getConfig(),
        aiConfigAPI.getProviders(),
      ]);
      setConfig(configRes);
      setProviders(providersRes.providers);
      setDefaultProvider(configRes.default_provider);
      setEnableFallback(configRes.enable_fallback);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load AI configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const updatedConfig = await aiConfigAPI.updateConfig({
        default_provider: defaultProvider,
        enable_fallback: enableFallback,
      });
      setConfig(updatedConfig);
      setSuccess('AI configuration saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save AI configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const isProviderConfigured = (providerId: string) => {
    return config?.configured_providers.includes(providerId as AIProvider);
  };

  const getProviderModels = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    return provider?.models || [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6" />
            AI Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure AI providers for incident analysis, runbook automation, and more
          </p>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/50 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Environment Fallback Notice */}
      {config?.has_env_fallback && (
        <div className="bg-blue-500/10 border border-blue-500/50 text-blue-700 px-4 py-3 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Environment API Key Available</p>
            <p className="text-sm mt-1">
              A system-wide Anthropic API key is configured. You can use AI features without adding your own key,
              or add organization-specific keys for billing separation.
            </p>
          </div>
        </div>
      )}

      {/* Default Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Default AI Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select the default provider for AI-powered features. Only providers with configured API keys can be selected.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {(['anthropic', 'openai', 'google'] as AIProvider[]).map((providerId) => {
              const info = PROVIDER_INFO[providerId];
              const configured = isProviderConfigured(providerId);
              const models = getProviderModels(providerId);
              const isSelected = defaultProvider === providerId;
              const canSelect = configured || (providerId === 'anthropic' && config?.has_env_fallback);

              return (
                <div
                  key={providerId}
                  onClick={() => canSelect && setDefaultProvider(providerId)}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : canSelect
                        ? 'border-border hover:border-primary/50 cursor-pointer'
                        : 'border-border opacity-50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-5 h-5 text-primary" />
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg ${info.color} flex items-center justify-center text-white font-bold text-sm`}>
                      AI
                    </div>
                    <div>
                      <h3 className="font-semibold">{info.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {configured ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Configured
                          </span>
                        ) : providerId === 'anthropic' && config?.has_env_fallback ? (
                          <span className="text-blue-600">System key available</span>
                        ) : (
                          <span className="text-muted-foreground">Not configured</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">{info.description}</p>

                  {models.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">{models.length} models available</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              API keys are configured per-provider below
            </p>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Models */}
      <Card>
        <CardHeader>
          <CardTitle>Available Models</CardTitle>
        </CardHeader>
        <CardContent>
          {providers.filter((p) => p.models.length > 0).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No AI providers configured yet.</p>
              <p className="text-sm mt-1">
                Configure an AI provider API key to see available models.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {providers
                .filter((p) => p.models.length > 0)
                .map((provider) => (
                  <div key={provider.id}>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded ${PROVIDER_INFO[provider.id as AIProvider]?.color || 'bg-gray-500'} flex items-center justify-center text-white text-xs font-bold`}
                      >
                        AI
                      </div>
                      {provider.name}
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-medium">Model</th>
                            <th className="text-left py-2 px-3 font-medium">Capabilities</th>
                            <th className="text-right py-2 px-3 font-medium">Context</th>
                            <th className="text-right py-2 px-3 font-medium">Input Price</th>
                            <th className="text-right py-2 px-3 font-medium">Output Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {provider.models.map((model) => (
                            <tr key={model.id} className="border-b border-border/50 hover:bg-muted/50">
                              <td className="py-2 px-3">
                                <span className="font-mono text-xs">{model.id}</span>
                                <div className="text-xs text-muted-foreground">{model.name}</div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {model.capabilities.map((cap) => (
                                    <span
                                      key={cap}
                                      className="px-1.5 py-0.5 bg-muted rounded text-xs capitalize"
                                    >
                                      {cap}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-xs">
                                {(model.context_window / 1000).toFixed(0)}K
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-xs">
                                ${model.input_price_per_million.toFixed(2)}/M
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-xs">
                                ${model.output_price_per_million.toFixed(2)}/M
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Settings (collapsed by default) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advanced Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Enable Provider Fallback</h4>
              <p className="text-sm text-muted-foreground">
                Automatically fall back to another provider if the primary fails
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableFallback}
                onChange={(e) => setEnableFallback(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {enableFallback && (
            <div className="pl-4 border-l-2 border-primary/20 text-sm text-muted-foreground">
              <p>
                When enabled, if the default provider is unavailable or returns an error, the system will automatically
                try other configured providers in order of preference.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AISettings;
