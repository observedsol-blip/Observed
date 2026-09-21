// The real notifier: expo-notifications, local only.
//
// Inexact on purpose (owner, 21.09.2026): a reminder a few minutes late costs nothing, an extra
// permission (SCHEDULE_EXACT_ALARM) costs trust. And the permission for notifications is asked
// only from `request()`, which only `enableReminders` calls, which only a tap reaches.
import * as Notifications from "expo-notifications";
import type { Notifier, Reminder } from "../core/reminders.ts";

export class ExpoNotifier implements Notifier {
  async granted(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  }

  async request(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  }

  async schedule(reminder: Reminder): Promise<void> {
    const seconds = Math.max(1, reminder.atSeconds - Math.floor(Date.now() / 1000));
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: reminder.title, body: reminder.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        // no exact alarm, no repeat: the schedule is rebuilt whenever the app is opened
        repeats: false,
      },
    });
  }

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}
