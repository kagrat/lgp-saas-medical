import ChatWindow from '../components/ChatWindow'

export default function SupportChat() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-2">Support</h1>
      <p className="text-forest-700 mb-8">
        Une question technique ou administrative sur la plateforme ? Écris directement à l'équipe SpeedSanté+.
      </p>
      <ChatWindow
        fetchUrl="/support/messages/mine"
        sendUrl="/support/messages"
        currentSenderRole="user"
        title="Support SpeedSanté+"
      />
    </div>
  )
}
