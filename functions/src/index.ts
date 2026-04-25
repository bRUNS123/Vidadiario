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
  bano: '🧼',
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

    const chatId = String(message.chat.id);

    if (message.text.trim() === '/start') {
      await reply(`¡Bienvenido a Diario AG! 🚀\n\nTu Código de Vinculación de Telegram es:\n\`${chatId}\`\n\nCopia este código y pégalo en Configuración > Vincular con Telegram dentro del Dashboard Web para comenzar a guardar registros en tu cuenta.`);
      res.status(200).send('OK');
      return;
    }

    const linkedSnap = await db.collection('telegram_users').doc(chatId).get();
    
    if (!linkedSnap.exists) {
      await reply(`⚠️ Tu cuenta no está vinculada.\nTu Código de Vinculación es:\n\`${chatId}\`\nIngrésalo en la Configuración de tu Dashboard Web.`);
      res.status(200).send('OK');
      return;
    }

    const userId = linkedSnap.data()?.userId;

    const parsed = await parseMessage(
      message.text,
      db,
      userId,
      message.message_id
    );

    if (!parsed) {
      await reply('⚠️ No se pudo procesar el mensaje.');
      res.status(200).send('OK');
      return;
    }

    parsed.userId = userId;

    await db.collection('registros').add(parsed);
    if (parsed.category === 'unknown') {
      await reply(`❓ Desconocido. Guardado en el Inbox para que lo clasifiques.`);
    } else {
      await reply(`${EMOJI[parsed.category] || '✅'} Registrado en el inbox. Pendiente de aprobación.`);
    }
    
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
