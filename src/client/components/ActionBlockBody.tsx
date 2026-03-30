import type { ActionDefinition, BlockRecord } from "../../types.ts";

const ACTION_COLORS: Record<string, string> = {
  red: "bg-red-100 text-red-700 hover:bg-red-200",
  orange: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  yellow: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
  green: "bg-green-100 text-green-700 hover:bg-green-200",
  blue: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  purple: "bg-purple-100 text-purple-700 hover:bg-purple-200",
};

function parseActions(block: BlockRecord): ActionDefinition[] {
  if (!block.actions) return [];
  try {
    const parsed: unknown = JSON.parse(block.actions);
    if (!Array.isArray(parsed)) return [];
    return parsed as ActionDefinition[];
  } catch {
    return [];
  }
}

type ActionBlockBodyProps = {
  block: BlockRecord;
  compact?: boolean;
};

export function ActionBlockBody({ block, compact }: ActionBlockBodyProps) {
  const actions = parseActions(block);

  return (
    <div>
      {block.title && (
        <h2
          className={`font-semibold text-zinc-900 ${compact ? "text-base mb-1" : "text-lg mb-2"}`}
        >
          {block.title}
        </h2>
      )}
      {actions.length === 0 ? (
        <p className="text-sm text-zinc-400">No actions configured</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const color = action.color ?? "green";
            const classes = ACTION_COLORS[color] ?? ACTION_COLORS.green;
            return (
              <a
                key={action.name}
                href={`/action/${block.uuid}/${action.name}`}
                data-action-link="true"
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${classes} no-underline transition-colors cursor-pointer`}
              >
                {action.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
