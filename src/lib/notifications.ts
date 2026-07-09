import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(title: string, body: string, date: Date, isWakeupAlarm = false) {
  if (!Capacitor.isNativePlatform()) return

  const notifId = Math.floor(Math.random() * 1000000000)
  
  // Ensure the time is in the future
  let scheduleDate = date
  if (scheduleDate <= new Date()) {
    scheduleDate = new Date(new Date().getTime() + 5000) // 5s from now
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        title,
        body,
        id: notifId,
        schedule: { at: scheduleDate },
        smallIcon: 'ic_stat_icon_config_sample',
        extra: { isWakeupAlarm }
      }
    ]
  })
}

/**
 * NOTE ON PUSH NOTIFICATIONS:
 * Real remote push notifications (e.g. for chat messages or when an admin adds an expense) 
 * require a backend service (like a Supabase Edge Function or Firebase Cloud Function) 
 * that listens to database changes and sends payloads to the FCM tokens stored in the `profiles.fcm_token` column.
 * 
 * The client app already requests Push permissions and saves the fcm_token in AuthContext.tsx.
 */
