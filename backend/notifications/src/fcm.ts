// backend/notifications/src/fcm.ts
//
// Firebase Cloud Messaging dispatch. The real HTTP call to FCM is only made when
// FCM_SERVER_KEY is configured; otherwise this is a no-op that still reports how
// many tokens *would* have been targeted. This keeps the feature testable and
// deployable before FCM credentials are wired up (see plan/03-features-v1.md).

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  targeted: number;
  delivered: boolean;
}

export async function sendPush(tokens: string[], payload: PushPayload): Promise<PushResult> {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey || tokens.length === 0) {
    return { targeted: tokens.length, delivered: false };
  }
  // Legacy FCM HTTP API — swap for the HTTP v1 API + service account when the
  // project's FCM credentials are provisioned.
  await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${serverKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
    }),
  });
  return { targeted: tokens.length, delivered: true };
}
