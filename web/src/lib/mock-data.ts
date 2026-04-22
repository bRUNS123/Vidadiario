import { DiarioRecord } from './types';

const now = Math.floor(Date.now() / 1000);
const hoy = (offsetSeconds: number) => ({ seconds: now - offsetSeconds, nanoseconds: 0 });
const ayer = (offsetSeconds: number) => ({ seconds: now - 86400 - offsetSeconds, nanoseconds: 0 });

export const MOCK_PENDING: DiarioRecord[] = [
  {
    id: 'p1',
    category: 'agua',
    rawText: '+h2o 500',
    parsedData: { cantidad: 500, unidad: 'ml' },
    notificar: false,
    status: 'pending',
    createdAt: hoy(120),
  },
  {
    id: 'p2',
    category: 'actividad',
    rawText: '+af Pesas 45',
    parsedData: { nombre: 'Pesas', minutos: 45 },
    notificar: false,
    status: 'pending',
    createdAt: hoy(800),
  },
  {
    id: 'p3',
    category: 'agenda',
    rawText: '!cita Dentista 10:30',
    parsedData: { evento: 'Dentista', hora: '10:30' },
    notificar: true,
    status: 'pending',
    createdAt: hoy(1800),
  },
  {
    id: 'p4',
    category: 'alimentacion',
    rawText: '+com Ensalada César',
    parsedData: { descripcion: 'Ensalada César' },
    notificar: false,
    status: 'pending',
    createdAt: hoy(3600),
  },
];

export const MOCK_CONFIRMED: DiarioRecord[] = [
  {
    id: 'c1',
    category: 'agua',
    rawText: '+h2o 330',
    parsedData: { cantidad: 330, unidad: 'ml' },
    notificar: false,
    status: 'confirmed',
    createdAt: hoy(7200),
    confirmedAt: hoy(6000),
  },
  {
    id: 'c2',
    category: 'medicina',
    rawText: '+med Creatina 5g',
    parsedData: { nombre: 'Creatina', dosis: '5g' },
    notificar: false,
    status: 'confirmed',
    createdAt: hoy(8000),
    confirmedAt: hoy(7500),
  },
  {
    id: 'c3',
    category: 'ocio',
    rawText: '+ocio Series 60',
    parsedData: { actividad: 'Series', minutos: 60 },
    notificar: false,
    status: 'confirmed',
    createdAt: hoy(14400),
    confirmedAt: hoy(14000),
  },
  {
    id: 'c4',
    category: 'actividad',
    rawText: '+af Correr 30',
    parsedData: { nombre: 'Correr', minutos: 30 },
    notificar: false,
    status: 'confirmed',
    createdAt: ayer(3600),
    confirmedAt: ayer(3000),
  },
  {
    id: 'c5',
    category: 'agua',
    rawText: '+h2o 250',
    parsedData: { cantidad: 250, unidad: 'ml' },
    notificar: false,
    status: 'confirmed',
    createdAt: ayer(7200),
    confirmedAt: ayer(6800),
  },
  {
    id: 'c6',
    category: 'alimentacion',
    rawText: '+com Avena con fruta',
    parsedData: { descripcion: 'Avena con fruta' },
    notificar: false,
    status: 'confirmed',
    createdAt: ayer(10800),
    confirmedAt: ayer(10000),
  },
];
