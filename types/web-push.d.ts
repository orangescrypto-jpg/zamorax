declare module "web-push" {
  export interface VapidKeys {
    publicKey: string
    privateKey: string
  }

  export interface PushSubscriptionKeys {
    p256dh: string
    auth: string
  }

  export interface PushSubscription {
    endpoint: string
    expirationTime?: number | null
    keys: PushSubscriptionKeys
  }

  export interface RequestOptions {
    gcmAPIKey?: string
    vapidDetails?: {
      subject: string
      publicKey: string
      privateKey: string
    }
    TTL?: number
    headers?: Record<string, string>
    contentEncoding?: string
    proxy?: string
    agent?: unknown
    timeout?: number
  }

  export interface SendResult {
    statusCode: number
    body: string
    headers: Record<string, string>
  }

  export function generateVAPIDKeys(): VapidKeys

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void

  export function setGCMAPIKey(apiKey: string): void

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions
  ): Promise<SendResult>

  const webpush: {
    generateVAPIDKeys: typeof generateVAPIDKeys
    setVapidDetails: typeof setVapidDetails
    setGCMAPIKey: typeof setGCMAPIKey
    sendNotification: typeof sendNotification
  }

  export default webpush
}

