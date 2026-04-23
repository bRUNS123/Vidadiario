import { NextRequest, NextResponse } from 'next/server';
import { addDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseMessage } from '@/lib/parser-web';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ALLOWED_IDS = process.env.ALLOWED_TELEGRAM_USER_IDS?.split(',').map((s) => s.trim()) ?? [];

const EMOJI: Record<string, string> = {
  agua: '💧',
  actividad: '💪',
  alimentacion: '🥗',
  medicina: '💊',
  ocio: '🎮',
  agenda: '📅',
};

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const message = update?.message;

    if (!message?.text) return NextResponse.json({ ok: true });

    // Restrict to allowed Telegram user IDs
    if (ALLOWED_IDS.length && message.from && !ALLOWED_IDS.includes(String(message.from.id))) {
      return NextResponse.json({ ok: true });
    }

    const parsed = await parseMessage(
      message.text,
      {
        getAliases: async () => {
          const snapshot = await getDocs(collection(db, 'aliasMappings'));
          return snapshot.docs.map(doc => doc.data());
        }
      },
      message.from ? String(message.from.id) : undefined,
      message.message_id
    );

    if (!parsed) {
      await sendMessage(message.chat.id, '⚠️ No se pudo procesar el mensaje.');
      return NextResponse.json({ ok: true });
    }

    await addDoc(collection(db, 'registros'), {
      ...parsed,
      createdAt: serverTimestamp(),
    });

    await sendMessage(
      message.chat.id,
      `${EMOJI[parsed.category]} Registrado en el inbox. Pendiente de aprobación.`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}
