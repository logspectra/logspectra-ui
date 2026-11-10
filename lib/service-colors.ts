const SERVICE_COLORS: Record<string, string> = {
  "api-gateway": "#3b82f6",
  "auth-service": "#ef4444",
  "payment-service": "#f97316",
  "admin-service": "#a855f7",
  "user-service": "#22c55e",
  "gateway-service": "#06b6d4",
};

export const serviceColor = (service: string): string =>
  SERVICE_COLORS[service] ?? "#64748b";
