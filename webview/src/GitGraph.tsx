import React, { useEffect, useRef, useState } from 'react';
import { Commit } from './types';

interface GraphProps {
  commits: Commit[];
  rowHeight: number;
  onWidthChange?: (width: number) => void;
  isLinear?: boolean;
}

const COLORS = [
  '#4a9eff', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd'
];

const CHUNK_SIZE = 1000;

export const GitGraph: React.FC<GraphProps> = ({ commits, rowHeight, onWidthChange, isLinear }) => {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const chunksCount = Math.max(1, Math.ceil(commits.length / CHUNK_SIZE));
  const [themeTick, setThemeTick] = useState(0);

  // CR-005: Observe style changes on document.body to detect VS Code theme switch
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeTick(tick => tick + 1);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!commits.length) return;

    const dpr = window.devicePixelRatio || 1;
    // We assume the background color is the same across chunks, we can get it from the container or body.
    const bgColor = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';

    if (isLinear) {
      const displayWidth = 40;
      const xOffset = 20;
      if (onWidthChange) {
        onWidthChange(displayWidth);
      }
      for (let c = 0; c < chunksCount; c++) {
        const canvas = canvasRefs.current[c];
        if (!canvas) continue;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        const chunkCommitsCount = Math.min(CHUNK_SIZE, commits.length - c * CHUNK_SIZE);
        const displayHeight = chunkCommitsCount * rowHeight;

        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, displayWidth, displayHeight);

        ctx.save();
        ctx.translate(0, -c * CHUNK_SIZE * rowHeight);

        // Draw straight vertical connection line
        ctx.beginPath();
        ctx.strokeStyle = COLORS[0];
        ctx.lineWidth = 2;
        ctx.moveTo(xOffset, rowHeight / 2);
        ctx.lineTo(xOffset, (commits.length - 1) * rowHeight + rowHeight / 2);
        ctx.stroke();

        // Draw nodes for THIS chunk
        const startIdx = c * CHUNK_SIZE;
        const endIdx = startIdx + chunkCommitsCount;
        for (let i = startIdx; i < endIdx; i++) {
          const y = i * rowHeight + rowHeight / 2;
          ctx.beginPath();
          ctx.fillStyle = COLORS[0];
          ctx.arc(xOffset, y, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.strokeStyle = bgColor;
          ctx.lineWidth = 1;
          ctx.arc(xOffset, y, 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      return;
    }

    const commitIndices = new Map<string, number>();
    commits.forEach((c, idx) => {
      commitIndices.set(c.hash, idx);
    });

    const activeLanes: (string | null)[] = [];
    const commitLanes: number[] = [];
    let maxLanesCount = 0;

    // Calculate lanes globally
    commits.forEach((commit, i) => {
      let laneIndex = activeLanes.indexOf(commit.hash);
      if (laneIndex === -1) {
        laneIndex = activeLanes.indexOf(null);
        if (laneIndex === -1) {
          laneIndex = activeLanes.length;
          activeLanes.push(commit.hash);
        } else {
          activeLanes[laneIndex] = commit.hash;
        }
      }
      commitLanes[i] = laneIndex;
      maxLanesCount = Math.max(maxLanesCount, activeLanes.length);

      activeLanes[laneIndex] = null;
      commit.parents.forEach(parentHash => {
        const parentExistsInList = commitIndices.has(parentHash);
        if (parentExistsInList) {
          if (activeLanes.indexOf(parentHash) === -1) {
            const emptySlot = activeLanes.indexOf(null);
            if (emptySlot !== -1) {
              activeLanes[emptySlot] = parentHash;
            } else {
              activeLanes.push(parentHash);
            }
          }
        }
      });
      maxLanesCount = Math.max(maxLanesCount, activeLanes.length);
    });

    const laneWidth = 12;
    const xOffset = 10;

    // Calculate required width based on actual max lanes used
    const displayWidth = Math.max(40, (maxLanesCount) * laneWidth + xOffset + 10);

    // Notify parent of the calculated width
    if (onWidthChange) {
      onWidthChange(displayWidth);
    }

    for (let c = 0; c < chunksCount; c++) {
      const canvas = canvasRefs.current[c];
      if (!canvas) continue;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const chunkCommitsCount = Math.min(CHUNK_SIZE, commits.length - c * CHUNK_SIZE);
      const displayHeight = chunkCommitsCount * rowHeight;

      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      ctx.save();
      ctx.translate(0, -c * CHUNK_SIZE * rowHeight);

      const chunkTopY = c * CHUNK_SIZE * rowHeight;
      const chunkBottomY = (c + 1) * CHUNK_SIZE * rowHeight;

      // Pass 1: Draw lines (only lines intersecting this chunk)
      commits.forEach((commit, i) => {
        const y = i * rowHeight + rowHeight / 2;
        const x = xOffset + commitLanes[i] * laneWidth;

        commit.parents.forEach(parentHash => {
          const idxVal = commitIndices.get(parentHash);
          const parentIdx = (idxVal !== undefined && idxVal > i) ? idxVal : -1;
          if (parentIdx !== -1) {
            const targetY = parentIdx * rowHeight + rowHeight / 2;
            const targetX = xOffset + commitLanes[parentIdx] * laneWidth;

            const minY = Math.min(y, targetY) - rowHeight;
            const maxY = Math.max(y, targetY) + rowHeight;

            if (maxY >= chunkTopY && minY <= chunkBottomY) {
              ctx.beginPath();
              ctx.strokeStyle = COLORS[commitLanes[i] % COLORS.length];
              ctx.lineWidth = 2;
              if (x === targetX) {
                ctx.moveTo(x, y);
                ctx.lineTo(targetX, targetY);
              } else {
                const radius = Math.min(8, Math.abs(x - targetX));
                if (x < targetX) {
                  // 下一个点在左边：先上再左
                  ctx.moveTo(targetX, targetY);
                  ctx.arcTo(targetX, y, x, y, radius);
                  ctx.lineTo(x, y);
                } else {
                  // 下一个点在右边：先右再上
                  ctx.moveTo(targetX, targetY);
                  ctx.arcTo(x, targetY, x, y, radius);
                  ctx.lineTo(x, y);
                }
              }
              ctx.stroke();
            }
          }
        });
      });

      // Pass 2: Draw nodes for THIS chunk
      const startIdx = c * CHUNK_SIZE;
      const endIdx = startIdx + chunkCommitsCount;
      for (let i = startIdx; i < endIdx; i++) {
        const y = i * rowHeight + rowHeight / 2;
        const x = xOffset + commitLanes[i] * laneWidth;

        ctx.beginPath();
        ctx.fillStyle = COLORS[commitLanes[i] % COLORS.length];
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = bgColor;
        ctx.lineWidth = 1;
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // CR-005: Added themeTick and onWidthChange to dependencies
  }, [commits, rowHeight, isLinear, chunksCount, onWidthChange, themeTick]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: chunksCount }).map((_, i) => (
        <canvas
          key={i}
          ref={el => { canvasRefs.current[i] = el; }}
          style={{ verticalAlign: 'top', display: 'block' }}
        />
      ))}
    </div>
  );
};
