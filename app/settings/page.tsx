"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { api, AiSettings } from "@/lib/api";

const OLLAMA_DEFAULT_PORT = "11434";

export default function Settings() {
  const settings = {
    alertThreshold: "0",
    retentionDays: "0",
    samplingRate: "0",
    enableNotifications: false,
    enableCaching: false,
    theme: "0",
  };
  const [ai, setAi] = useState<AiSettings>({ provider: "OPENAI", modelName: "", baseUrl: "", active: true });
  const [selectedProvider, setSelectedProvider] = useState<AiSettings["provider"] | "">("");
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const active = await api.getAiSettings();
        setAi({ ...active });
        setSelectedProvider(active.provider);
      } catch {
        // no active provider yet
        setSelectedProvider("");
      }
    };
    void load();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      if (!selectedProvider) {
        setProviderModels([]);
        setAi((prev) => ({ ...prev, modelName: "" }));
        setModelFetchError("");
        setIsLoadingModels(false);
        return;
      }

      setIsLoadingModels(true);
      setModelFetchError("");
      try {
        const models = await api.getProviderModels(selectedProvider);
        if (cancelled) return;

        setProviderModels(models || []);
        setAi((prev) => ({
          ...prev,
          provider: selectedProvider,
          modelName: models.length > 0 ? models[0] : "",
        }));
        if (models.length === 0) {
          setModelFetchError("No models available for selected provider");
        }
      } catch {
        if (!cancelled) {
          setProviderModels([]);
          setAi((prev) => ({ ...prev, provider: selectedProvider, modelName: "" }));
          setModelFetchError(`Failed to load models for ${selectedProvider}`);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingModels(false);
        }
      }
    };

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [selectedProvider]);

  const modelOptions = useMemo(() => {
    const options = Array.from(new Set(providerModels));
    if (ai.modelName && !options.includes(ai.modelName)) {
      options.unshift(ai.modelName);
    }
    return options;
  }, [providerModels, ai.modelName]);

  const handleProviderChange = (provider: AiSettings["provider"]) => {
    setSelectedProvider(provider);
    if (provider === "OLLAMA") {
      setAi({ ...ai, provider, baseUrl: `http://localhost:${OLLAMA_DEFAULT_PORT}` });
      return;
    }

    setAi({ ...ai, provider, baseUrl: "" });
  };

  const handleSave = async () => {
    try {
      if (!selectedProvider) {
        setError("Please select a provider");
        return;
      }

      const payload: AiSettings =
        selectedProvider === "OLLAMA"
          ? {
              ...ai,
              provider: selectedProvider,
              active: true,
              apiKey: undefined,
              baseUrl: `http://localhost:${OLLAMA_DEFAULT_PORT}`,
            }
          : {
              ...ai,
              provider: selectedProvider,
              active: true,
              apiKey: undefined,
              baseUrl: undefined,
            };

      await api.upsertAiSettings(payload);
      setSaved(true);
      setError("");
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="w-5 h-5 text-blue-500" />
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">Configure LogSpectra dashboard and monitoring preferences</p>
      </div>

      <Card className="p-6"><h3 className="text-lg font-semibold text-foreground mb-4">Alert Configuration</h3><div className="space-y-4"><div><Label className="text-sm text-muted-foreground mb-2 block">Error Rate Alert Threshold</Label><div className="flex items-center gap-2"><Input type="number" value={settings.alertThreshold} disabled readOnly className="bg-input border-border text-foreground max-w-xs" /><span className="text-sm text-muted-foreground">errors per minute</span></div></div></div></Card>

      <Card className="p-6"><h3 className="text-lg font-semibold text-foreground mb-4">Data Retention</h3><Select value={settings.retentionDays} disabled><SelectTrigger className="bg-input border-border text-foreground max-w-xs"><SelectValue /></SelectTrigger><SelectContent className="bg-popover border-border"><SelectItem value="0">0</SelectItem><SelectItem value="7">7 days</SelectItem><SelectItem value="14">14 days</SelectItem><SelectItem value="30">30 days</SelectItem><SelectItem value="60">60 days</SelectItem><SelectItem value="90">90 days</SelectItem></SelectContent></Select></Card>

      <Card className="p-6"><h3 className="text-lg font-semibold text-foreground mb-4">Performance</h3><div className="space-y-4"><div><Label className="text-sm text-muted-foreground mb-2 block">Log Sampling Rate</Label><div className="flex items-center gap-2"><Input type="number" min="0" max="100" value={settings.samplingRate} disabled readOnly className="bg-input border-border text-foreground max-w-xs" /><span className="text-sm text-muted-foreground">%</span></div></div><div className="pt-2 border-t border-border"><div className="flex items-center justify-between"><Label className="text-sm text-muted-foreground">Enable AI Result Caching</Label><Switch checked={settings.enableCaching} disabled /></div></div></div></Card>

      <Card className="p-6"><h3 className="text-lg font-semibold text-foreground mb-4">Notifications</h3><div className="flex items-center justify-between"><Label className="text-sm text-muted-foreground">Enable Real-time Alerts</Label><Switch checked={settings.enableNotifications} disabled /></div></Card>

      <Card className="p-6"><h3 className="text-lg font-semibold text-foreground mb-4">Display</h3><Select value={settings.theme} disabled><SelectTrigger className="bg-input border-border text-foreground max-w-xs"><SelectValue /></SelectTrigger><SelectContent className="bg-popover border-border"><SelectItem value="0">0</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="auto">Auto (System)</SelectItem></SelectContent></Select></Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">AI Provider Settings</h3>
        <div className="space-y-3">
          <Select value={selectedProvider} onValueChange={(provider) => handleProviderChange(provider as AiSettings["provider"])}>
            <SelectTrigger className="bg-input border-border text-foreground"><SelectValue placeholder="Select provider" /></SelectTrigger>
            <SelectContent className="bg-popover border-border"><SelectItem value="OPENAI">OPENAI</SelectItem><SelectItem value="OLLAMA">OLLAMA</SelectItem><SelectItem value="CLAUDE">CLAUDE</SelectItem></SelectContent>
          </Select>
          <Select value={ai.modelName} onValueChange={(modelName) => setAi({ ...ai, modelName })}>
            <SelectTrigger className="bg-input border-border text-foreground" disabled={!selectedProvider || isLoadingModels || modelOptions.length === 0}>
              <SelectValue placeholder={isLoadingModels ? "Loading models..." : "Select model"} />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {modelOptions.length > 0 ? (
                modelOptions.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__no_models" disabled>
                  No models available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {modelFetchError && <p className="text-xs text-red-500">{modelFetchError}</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </Card>

      <Card className="p-6"><h3 className="text-lg font-semibold text-foreground mb-4">System Status</h3><div className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Dashboard Version</span><Badge className="bg-blue-900 text-blue-100">v1.0.0</Badge></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Data Source</span><Badge className="bg-green-900 text-green-100">Backend API</Badge></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Last Updated</span><span className="text-sm text-foreground">{new Date().toLocaleString()}</span></div></div></Card>

      <div className="flex gap-2"><Button onClick={() => void handleSave()} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save Settings</Button>{saved && <Badge className="bg-green-900 text-green-100 animate-pulse">Settings saved successfully</Badge>}</div>
    </div>
  );
}
