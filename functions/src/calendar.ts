import { google } from 'googleapis';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const TIMEZONE = 'America/Bogota';

export async function createCalendarEvent(record: {
  parsedData: { evento?: string; hora?: string };
}): Promise<string> {
  // Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to service-account.json
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  const { evento, hora } = record.parsedData;
  const today = new Date().toISOString().split('T')[0];

  let startDateTime: string;
  let endDateTime: string;

  if (hora && /^\d{1,2}:\d{2}$/.test(hora)) {
    const [h, m] = hora.split(':').map(Number);
    const endMinutes = m + 30;
    const endHour = h + Math.floor(endMinutes / 60);
    startDateTime = `${today}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    endDateTime = `${today}T${String(endHour).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;
  } else {
    startDateTime = `${today}T09:00:00`;
    endDateTime = `${today}T09:30:00`;
  }

  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: evento || 'Cita (Diario AG)',
      start: { dateTime: startDateTime, timeZone: TIMEZONE },
      end: { dateTime: endDateTime, timeZone: TIMEZONE },
    },
  });

  return response.data.id ?? '';
}
