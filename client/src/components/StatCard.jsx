const StatCard = ({ title, value, icon: Icon, color = 'primary', subtitle }) => {
  const colorClasses = {
    primary: 'bg-primary-100 text-primary-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-primary-100 text-primary-600',
    purple: 'bg-purple-100 text-purple-600'
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
