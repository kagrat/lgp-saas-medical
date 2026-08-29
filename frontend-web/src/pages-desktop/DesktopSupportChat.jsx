import ChatWindow from '../components/ChatWindow'

export default function DesktopSupportChat() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-2">Support SpeedSanté+</h1>
      <p className="text-forest-700 mb-8">
        Question technique ou administrative sur la plateforme ? Ecris directement a l'equipe SpeedSanté+.
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
