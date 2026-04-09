import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface StatusBadgeProps {
  status: 'verified' | 'pending' | 'rejected';
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = {
    verified: {
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      label: 'Verified'
    },
    pending: {
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      label: 'Pending'
    },
    rejected: {
      icon: XCircle,
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      label: 'Rejected'
    }
  };

  const { icon: Icon, color, label } = config[status];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'size-3',
    md: 'size-4',
    lg: 'size-5'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${color} ${sizeClasses[size]}`}>
      <Icon className={iconSizes[size]} />
      {label}
    </span>
  );
}
