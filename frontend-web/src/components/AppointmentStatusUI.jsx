const STATUS_LABELS = {
  confirmed: 'Confirme',
  arrived: 'Arrive',
  completed: 'Termine',
  cancelled: 'Annule',
  no_show: 'Absent',
}

const STATUS_COLORS = {
  confirmed: 'bg-forest-50 text-forest-700',
  arrived: 'bg-amber-500/10 text-amber-600',
  completed: 'bg-forest-500/10 text-forest-700',
  cancelled: 'bg-clay-500/10 text-clay-600',
  no_show: 'bg-clay-500/10 text-clay-600',
}

export function AppointmentStatusBadge({ status }) {
  return (
    <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[status] || 'bg-forest-50 text-forest-700'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export const APPOINTMENT_STATUS_LABELS = STATUS_LABELS
export const APPOINTMENT_STEPS = ['confirmed', 'arrived', 'completed']
