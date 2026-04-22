import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { parseMessage } from './parser';
import { createCalendarEvent } from './calendar';

admin.initializeApp();
const db = admin.firestore();

const EMOJI: Record<string, string> = {
  agua: '💧',
  actividad: '💪',
  alimentacion: '🥗',
  medicina: '💊',
  ocio: '🎮',
  agenda: '📅',
};

// Register webhook: https://api.telegram.org/bot{TOKEN}/setWebhook?url={CLOUD_FUNCTION_URL}/telegramWebhook
export const telegramWebhook = onRequest(
  { secrets: ['TELEGRAM_BOT_TOKEN'] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const update = req.body as {
      message?: {
        message_id: number;
        text?: string;
        chat: { id: number };
        from?: { id: number };
      };
    };

    const message = update?.message;
    if (!message?.text) {
      res.status(200).send('OK');
      return;
    }

    const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

    async function reply(text: string) {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: message!.chat.id, text }),
      });
    }

    // Optional: restrict to allowed user IDs
    const allowedIds = process.env.ALLOWED_TELEGRAM_USER_IDS?.split(',').map((s) => s.trim());
    if (allowedIds?.length && message.from && !allowedIds.includes(String(message.from.id))) {
      res.status(200).send('OK');
      return;
    }

    const parsed = parseMessage(
      message.text,
      message.from ? String(message.from.id) : undefined,
      message.message_id
    );

    if (!parsed) {
      await reply(
        '⚠️ Formato no reconocido.\n\nEjemplos:\n+h2o 500\n+af Pesas 45\n+com Ensalada César\n+med Creatina 5g\n+ocio Series 60\n!cita Dentista 10:30'
      );
      res.status(200).send('OK');
      return;
    }

    await db.collection('registros').add(parsed);
    await reply(`${EMOJI[parsed.category]} Registrado en el inbox. Pendiente de aprobación.`);
    res.status(200).send('OK');
  }
);

export const onRecordConfirmed = onDocumentUpdated('registros/{recordId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.status !== 'confirmed') return;
  if (!after.notificar) return;

  try {
    const calendarEventId = await createCalendarEvent(after as any);
    await event.data!.after.ref.update({ calendarEventId });
  } catch (err) {
    console.error('Google Calendar sync failed:', err);
  }
});
