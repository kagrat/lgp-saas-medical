import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const FOREST = '#1B4D36'
const AMBER = '#D98E04'

export function RevenueTrendChart({ data }) {
  return (
    <div className="rounded-xl border border-forest-100 bg-white p-5">
      <p className="font-display text-lg text-forest-900 font-semibold mb-4">Revenu estime par mois</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF5F1" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#1B4D36' }} />
          <YAxis tick={{ fontSize: 12, fill: '#1B4D36' }} />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString('fr-FR')} FCFA`, 'Revenu']}
            contentStyle={{ borderRadius: 8, borderColor: '#D7E8DE' }}
          />
          <Line type="monotone" dataKey="revenue" stroke={FOREST} strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AppointmentsTrendChart({ data }) {
  return (
    <div className="rounded-xl border border-forest-100 bg-white p-5">
      <p className="font-display text-lg text-forest-900 font-semibold mb-4">Rendez-vous termines par mois</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF5F1" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#1B4D36' }} />
          <YAxis tick={{ fontSize: 12, fill: '#1B4D36' }} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#D7E8DE' }} />
          <Bar dataKey="appointments_count" fill={AMBER} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TopEstablishmentsChart({ data }) {
  return (
    <div className="rounded-xl border border-forest-100 bg-white p-5">
      <p className="font-display text-lg text-forest-900 font-semibold mb-4">Etablissements les plus actifs</p>
      <ResponsiveContainer width="100%" height={Math.max(280, data.length * 45)}>
        <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF5F1" />
          <XAxis type="number" tick={{ fontSize: 12, fill: '#1B4D36' }} allowDecimals={false} />
          <YAxis type="category" dataKey="establishment_name" tick={{ fontSize: 12, fill: '#1B4D36' }} width={140} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#D7E8DE' }} />
          <Bar dataKey="appointments_count" fill={FOREST} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
