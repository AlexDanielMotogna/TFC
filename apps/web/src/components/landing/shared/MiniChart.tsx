'use client';

interface MiniChartProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  positive?: boolean;
}

export function MiniChart({
  data,
  width = 100,
  height = 40,
  strokeWidth = 2,
  positive = true,
}: MiniChartProps) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={positive ? '#26A69A' : '#EF5350'}
          strokeWidth={strokeWidth}
          strokeDasharray="4 4"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height * 0.8 - height * 0.1;
    return `${x},${y}`;
  }).join(' ');

  const gradientId = `miniChartGradient-${Math.random().toString(36).substr(2, 9)}`;
  const strokeColor = positive ? '#26A69A' : '#EF5350';
  const fillColor = positive ? 'rgba(38, 166, 154, 0.1)' : 'rgba(239, 83, 80, 0.1)';

  // Create area path
  const firstPoint = `0,${height}`;
  const lastPoint = `${width},${height}`;
  const areaPath = `M ${firstPoint} L ${points} L ${lastPoint} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
