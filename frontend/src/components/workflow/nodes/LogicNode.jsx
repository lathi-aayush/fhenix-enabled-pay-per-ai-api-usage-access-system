import React, { memo } from "react";
import { Position } from "@xyflow/react";
import NodeShell from "./NodeShell.jsx";

function LogicNode({ id, data, selected }) {
  return (
    <NodeShell
      id={id}
      selected={selected}
      data={data}
      inputPosition={Position.Top}
      outputs={[
        { id: "true", position: Position.Bottom },
        { id: "false", position: Position.Right },
      ]}
    >
      <p className="text-[10px] text-on-surface-variant">{data?.conditionType || "if/else"}</p>
    </NodeShell>
  );
}

export default memo(LogicNode);
