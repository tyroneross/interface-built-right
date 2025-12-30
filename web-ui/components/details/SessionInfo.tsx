interface Session {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  viewport: {
    name: string;
    width: number;
    height: number;
  };
}

interface SessionInfoProps {
  session: Session;
}

export default function SessionInfo({ session }: SessionInfoProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div>
      {/* Title: session name */}
      <div className="text-[15px] font-medium text-gray-900">
        {session.name}
      </div>

      {/* Description: URL */}
      <div className="mt-0.5 text-[13px] text-gray-600 break-all">
        {session.url}
      </div>

      {/* Metadata: viewport and date */}
      <div className="mt-0.5 text-[11px] text-gray-500">
        {session.viewport.name} ({session.viewport.width}×{session.viewport.height}) • {formatDate(session.createdAt)}
      </div>
    </div>
  );
}
