import React, { memo } from "react";
import { BaseEdge, getBezierPath } from "@xyflow/react";

function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  animated,
}) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const executing = data?.executing;
  const stroke = executing ? "#22d3ee" : "#6366f1";

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke, strokeWidth: 2 }} />
      {animated && (
        <circle r="4" fill={stroke}>
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  );
}

export default memo(AnimatedEdge);
