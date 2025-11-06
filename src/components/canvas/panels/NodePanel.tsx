/**
 * Node Panel Component
 *
 * Sidebar panel showing available nodes grouped by category
 * Allows dragging nodes onto the canvas
 */

import { useState } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useNodesByCategory } from "@/hooks/use-node-registry";

interface NodePanelProps {
  onNodeDrag?: (nodeId: string, event: React.DragEvent) => void;
}

export function NodePanel({ onNodeDrag }: NodePanelProps) {
  const { categories, allNodes, isLoading } = useNodesByCategory();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});

  const filteredCategories = Object.entries(categories).reduce(
    (acc, [category, nodes]) => {
      const filtered = nodes.filter(
        (node) =>
          node.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      if (filtered.length > 0) {
        acc[category] = filtered;
      }
      return acc;
    },
    {} as Record<string, typeof allNodes>,
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  if (isLoading) {
    return (
      <div className="w-64 bg-editor-panel border-r  p-4">
        <div className="text-center text-gray-400">Loading nodes...</div>
      </div>
    );
  }

  const categoryOrder = [
    "trigger",
    "AI",
    "input",
    "output",
    "transform",
    "llm",
    "integration",
    "utility",
    "other",
  ];

  // Include all categories that have nodes, ordered by categoryOrder
  const sortedCategories = categoryOrder.filter(
    (cat) => filteredCategories[cat],
  );

  // Add any remaining categories not in the order list
  Object.keys(filteredCategories).forEach((cat) => {
    if (!sortedCategories.includes(cat)) {
      sortedCategories.push(cat);
    }
  });

  return (
    <div className="w-80 bg-editor-panel border-r overflow-y-auto h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-2">Nodes</h2>
        <Input
          type="text"
          placeholder="Search nodes..."
          className="bg-transparent! border"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Node Categories */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedCategories.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No nodes found</p>
            <p className="text-sm">Try adjusting your search</p>
          </div>
        ) : (
          sortedCategories.map((category) => (
            <Collapsible
              key={category}
              open={expandedCategories[category] ?? true}
              onOpenChange={() => toggleCategory(category)}
              className="mb-2"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-muted-foreground"
                >
                  <span className="capitalize font-medium">{category}</span>
                  <LucideIcon
                    name={
                      expandedCategories[category]
                        ? "chevron-down"
                        : "chevron-right"
                    }
                    className="h-4 w-4"
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex-col gap-2 flex">
                {filteredCategories[category]?.map((node) => (
                  <NodeItem key={node.id} node={node} onDrag={onNodeDrag} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Individual node item in the panel
 */
function NodeItem({
  node,
  onDrag,
}: {
  node: ReturnType<typeof useNodesByCategory>["allNodes"][0];
  onDrag?: (nodeId: string, event: React.DragEvent) => void;
}) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ nodeId: node.id }),
    );
    onDrag?.(node.id, e);
  };

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      className="text-start p-3 rounded bg-background shadow-xs muted-foreground border hover:border-surface-8 cursor-grab active:cursor-grabbing transition-colors"
    >
      <div className="flex items-center gap-4 ">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate flex items-center gap-2">
            <LucideIcon name={node.icon} className="w-4 h-4 text-blue-500!" />
            {node.displayName}
          </div>
          {node.description && (
            <div className="text-xs text-muted-foreground line-clamp-2">
              {node.description}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
