interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  positive?: boolean;
}

export default function SparklineChart({ data, width = 80, height = 30, color, positive = true }: SparklineProps) {
  const strokeColor = color || (positive ? '#10B981' : '#EF4444');
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
