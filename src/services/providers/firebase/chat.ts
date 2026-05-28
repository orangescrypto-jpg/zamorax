// src/services/providers/firebase/chat.ts
import {  collection, doc, getDoc, getDocs, addDoc, query,
  orderBy, limit, onSnapshot, serverTimestamp, where,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { IChatService } from "@/src/services/chat"
import type { Chat, ChatMessage } from "@/src/types"

const PHONE_REGEX = /(\+?\d{10,14}|0\d{10})|((whatsapp|wa\.me|telegram|phone|call)[\s:]?.+)/i

function toIso(ts: TimestampLike): string {
  if (!ts) return new Date().toISOString()
  if (ts?.toDate) return ts.toDate().toISOString()
  return new Date(ts).toISOString()
}

function mapMessage(id: string, data: DocumentData): ChatMessage {
  return {
    id,
    senderId:  data.senderId,
    text:      data.text,
    isBlocked: data.isBlocked ?? false,
    createdAt: toIso(data.createdAt),
  }
}

function mapChat(id: string, data: DocumentData): Chat {
  return {
    id,
    participants:  data.participants ?? [],
    listingId:     data.listingId,
    orderId:       data.orderId,
    isLocked:      data.isLocked ?? true,
    lastMessage:   data.lastMessage,
    lastMessageAt: data.lastMessageAt ? toIso(data.lastMessageAt) : undefined,
    createdAt:     toIso(data.createdAt),
  }
}

export const ChatService: IChatService = {

  async getChatById(chatId) {
    const snap = await getDoc(doc(db, "chats", chatId))
    if (!snap.exists()) return null
    return mapChat(snap.id, snap.data())
  },

  async getUserChats(userId) {
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", userId),
      orderBy("lastMessageAt", "desc"),
      limit(50),
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => mapChat(d.id, d.data()))
  },

  async sendMessage(chatId, senderId, text) {
    if (!chatId || !senderId || !text.trim()) return

    // Enforce contact-masking rule before escrow is funded
    const chatSnap = await getDoc(doc(db, "chats", chatId))
    const isLocked = chatSnap.exists() ? chatSnap.data().isLocked !== false : true

    if (isLocked && PHONE_REGEX.test(text)) {
      throw new Error("Contact details are hidden until escrow is funded.")
    }

    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId,
      text:      text.trim(),
      isBlocked: false,
      createdAt: serverTimestamp(),
    })
  },

  subscribeToMessages(chatId, callback) {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc"),
      limit(100),
    )
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => mapMessage(d.id, d.data())))
    })
  },

  subscribeToChat(chatId, callback) {
    return onSnapshot(doc(db, "chats", chatId), snap => {
      callback(snap.exists() ? mapChat(snap.id, snap.data()) : null)
    })
  },
}
