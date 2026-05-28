import { useRef, useEffect, useState } from "react"
import { useChat } from "@/hooks/useChat"
import { MessageBubble } from "./MessageBubble"
import { ChatLockNotice } from "./ChatLockNotice"
import { SafeMeetModal } from "./SafeMeetModal"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2, Shield } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export function ChatWindow({ chatId, userId, receiverName }: { chatId: string; userId: string; receiverName: string }) {
  const { messages, loading, sendMessage, escrowFunded } = useChat(chatId, userId)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [safeMeetOpen, setSafeMeetOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    try {
      await sendMessage(input)
      setInput("")
    } catch (err: any) {
      toast({ title: "Message Blocked", description: err.message, variant: "destructive" })
    } finally { setSending(false) }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="flex flex-col h-[650px] bg-background border rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
        <h3 className="font-semibold">Chat with {receiverName}</h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-primary/40 text-primary hover:bg-primary/5"
            onClick={() => setSafeMeetOpen(true)}
          >
            <Shield className="h-3 w-3 mr-1" />
            Safe Meet
          </Button>
          {!escrowFunded && <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded font-medium">Escrow Pending</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-8">No messages yet. Start the conversation!</div>
        )}
        {messages.map(m => <MessageBubble key={m.id} message={m} isOwn={m.senderId === userId} />)}
        <div ref={bottomRef} />
      </div>

      {!escrowFunded && <ChatLockNotice />}

      <form onSubmit={handleSend} className="p-3 border-t bg-background flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={!escrowFunded ? "Escrow must be funded to share contact details..." : "Type your message..."}
          className="flex-1 resize-none min-h-[44px] max-h-24"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
        />
        <Button type="submit" disabled={sending || !input.trim()} className="h-10 w-10 flex items-center justify-center bg-primary hover:bg-primary/90 text-white">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      <SafeMeetModal
        chatId={chatId}
        userId={userId}
        open={safeMeetOpen}
        onClose={() => setSafeMeetOpen(false)}
      />
    </div>
  )
}
