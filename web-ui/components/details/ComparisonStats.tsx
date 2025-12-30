interface Comparison {
  match: boolean;
  diffPercent: number;
  diffPixels: number;
  totalPixels: number;
  threshold: number;
}

interface Analysis {
  verdict: string;
  summary: string;
  recommendation: string | null;
}

interface ComparisonStatsProps {
  comparison?: Comparison;
  analysis?: Analysis;
}

export default function ComparisonStats({ comparison, analysis }: ComparisonStatsProps) {
  if (!comparison) {
    return null;
  }

  // Status text colors per Calm Precision (text only, no backgrounds)
  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'MATCH':
        return 'text-green-600';
      case 'EXPECTED_CHANGE':
        return 'text-blue-600';
      case 'UNEXPECTED_CHANGE':
        return 'text-amber-600';
      case 'LAYOUT_BROKEN':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const verdict = analysis?.verdict || 'PENDING';
  const verdictColor = getVerdictColor(verdict);

  return (
    <div>
      {/* Verdict row */}
      <div className="flex justify-between py-2">
        <span className="text-[13px] text-gray-500">Verdict</span>
        <span className={`text-[13px] font-medium ${verdictColor}`}>
          {verdict}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-50" />

      {/* Difference row */}
      <div className="flex justify-between py-2">
        <span className="text-[13px] text-gray-500">Difference</span>
        <span className="text-[13px] text-gray-900">
          {comparison.diffPercent.toFixed(1)}%
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-50" />

      {/* Pixels row */}
      <div className="flex justify-between py-2">
        <span className="text-[13px] text-gray-500">Pixels</span>
        <span className="text-[13px] text-gray-900">
          {comparison.diffPixels.toLocaleString()} changed
        </span>
      </div>
    </div>
  );
}
