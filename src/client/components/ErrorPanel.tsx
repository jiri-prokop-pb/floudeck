type ErrorPanelProps = {
  errorText: string;
  lastRunAt: string | null;
};

export function ErrorPanel({ errorText, lastRunAt }: ErrorPanelProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h4 className="text-sm font-semibold text-red-800">Task failed</h4>
      <p className="mt-1 text-sm text-red-700">{errorText}</p>
      {lastRunAt && (
        <p className="mt-2 text-xs text-red-500">
          Last attempted: {new Date(lastRunAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
