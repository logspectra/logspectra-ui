type PageErrorBannerProps = {
  message: string;
};

export function PageErrorBanner({ message }: PageErrorBannerProps) {
  if (!message.trim()) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
    >
      {message}
    </div>
  );
}
