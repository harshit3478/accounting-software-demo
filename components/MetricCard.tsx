interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
}

export default function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  iconBgColor,
  iconColor,
}: MetricCardProps) {
  const changeColorClass = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600',
  }[changeType];

  return (
    <div className="metric-card card-hover p-6 rounded-xl shadow-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${changeColorClass}`}>
              <span className="inline-flex items-center">{change}</span>
            </p>
          )}
        </div>
        <div className={`p-3 ${iconBgColor} rounded-full`}>
          <div className={`w-6 h-6 ${iconColor}`}>{icon}</div>
        </div>
      </div>
    </div>
  );
}