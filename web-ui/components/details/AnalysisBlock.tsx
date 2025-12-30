interface Analysis {
  verdict: string;
  summary: string;
  recommendation: string | null;
}

interface AnalysisBlockProps {
  analysis?: Analysis;
}

export default function AnalysisBlock({ analysis }: AnalysisBlockProps) {
  if (!analysis || !analysis.summary) {
    return (
      <p className="text-[13px] text-gray-500 leading-[1.5]">
        No analysis available yet.
      </p>
    );
  }

  return (
    <p className="text-[13px] text-gray-700 leading-[1.5]">
      {analysis.summary}
    </p>
  );
}
