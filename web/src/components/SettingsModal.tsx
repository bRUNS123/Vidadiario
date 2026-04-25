'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { user, logout } = useAuth();
  const [telegramId, setTelegramId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (snap.exists() && snap.data().telegramId) {
          setTelegramId(snap.data().telegramId);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSave() {
    if (!user || !telegramId.trim()) return;
    
    setSaving(true);
    setMessage('');
    
    const tid = telegramId.trim();
    
    try {
      // 1. Guardar en el documento del usuario
      await setDoc(doc(db, 'users', user.uid), { telegramId: tid }, { merge: true });
      
      // 2. Guardar el mapeo inverso para que el bot pueda encontrar al usuario rápido
      await setDoc(doc(db, 'telegram_users', tid), { userId: user.uid }, { merge: true });
      
      setMessage('✅ Telegram vinculado con éxito');
    } catch (error) {
      console.error(error);
      setMessage('❌ Error al vincular Telegram');
    } finally {
      setSaving(false);
    }
  }

  async function handleMigrate() {
    if (!user || user.email !== 'bfrancosentis@gmail.com') return;
    
    if (!window.confirm('¿Estás seguro de que quieres migrar todos los datos antiguos (huérfanos) a esta cuenta?')) return;
    
    setMigrating(true);
    setMessage('⏳ Migrando datos, por favor no cierres esta ventana...');
    
    try {
      let count = 0;
      const collections = ['registros', 'categorias', 'aliasMappings'];
      
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        const batch = writeBatch(db);
        let batchCount = 0;
        
        snap.forEach((d) => {
          const data = d.data();
          if (!data.userId) {
            batch.update(d.ref, { userId: user.uid });
            batchCount++;
            count++;
          }
        });
        
        if (batchCount > 0) {
          await batch.commit();
        }
      }
      
      setMessage(`✅ ¡Migración completada! Se asignaron ${count} documentos a tu cuenta.`);
      setTimeout(() => window.location.reload(), 3000);
    } catch (error) {
      console.error(error);
      setMessage('❌ Error al migrar. Revisa la consola.');
    } finally {
      setMigrating(false);
    }
  }

  async function handleInitCategories() {
    if (!user) return;
    if (!window.confirm('¿Quieres inicializar las categorías recomendadas (Líquidos, Gaming, Aseo, Comida) con sus subcategorías?')) return;

    setInitializing(true);
    setMessage('⏳ Creando categorías...');

    try {
      const templates = [
        { label: 'Líquidos', emoji: '💧', color: '#3b82f6', subcategories: ['Agua', 'Café', 'Té', 'Mate', 'Jugo', 'Soda'] },
        { label: 'Gaming', emoji: '🎮', color: '#a855f7', subcategories: ['Hots', 'LoL', 'TFT', 'Steam', 'YouTube', 'Twitch'] },
        { label: 'Aseo', emoji: '🚿', color: '#22c55e', subcategories: ['Ducha', 'Lavar Dientes', 'Baño', 'Skin Care'] },
        { label: 'Comida', emoji: '🍱', color: '#f59e0b', subcategories: ['Desayuno', 'Almuerzo', 'Cena', 'Snack', 'Fruta'] },
      ];

      for (const t of templates) {
        await setDoc(doc(collection(db, 'categorias')), {
          ...t,
          hasDuration: false,
          fields: [],
          userId: user.uid,
          createdAt: new Date(),
        });
      }

      setMessage('✅ Categorías recomendadas creadas. Recarga para ver los cambios.');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      console.error(err);
      setMessage('❌ Error al crear categorías');
    } finally {
      setInitializing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-950/50 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">⚙️ Configuración</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Perfil */}
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Perfil" className="h-10 w-10 rounded-full border border-zinc-200 dark:border-white/10" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-zinc-400">
                👤
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">{user?.displayName || 'Usuario'}</p>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{user?.email}</p>
            </div>
            <button 
              onClick={logout}
              className="ml-auto text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>

          <hr className="border-zinc-200 dark:border-white/5" />

          {/* Telegram vinculación */}
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span className="text-[#2AABEE]">✈️</span> Vincular con Telegram
            </h3>
            
            <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-3 border border-blue-100 dark:border-blue-500/20 text-[12px] text-blue-900 dark:text-blue-200">
              <p className="mb-1">Para que el bot guarde los mensajes en tu cuenta:</p>
              <ol className="list-decimal list-inside space-y-0.5 ml-1 opacity-80">
                <li>Abre Telegram y envíale <strong>/start</strong> al bot.</li>
                <li>El bot te responderá con tu "Código de Vinculación".</li>
                <li>Pégalo aquí abajo y guarda.</li>
              </ol>
            </div>

            {loading ? (
              <div className="animate-pulse h-9 bg-zinc-100 dark:bg-white/5 rounded-lg w-full"></div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: 123456789"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !telegramId.trim()}
                  className="rounded-lg bg-zinc-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-zinc-900 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '...' : 'Vincular'}
                </button>
              </div>
            )}
            
            {message && (
              <p className={`text-[12px] mt-1 ${message.includes('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {message}
              </p>
            )}

            <hr className="border-zinc-200 dark:border-white/5 my-4" />

            {/* Smart Setup */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>✨</span> Configuración Inteligente
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Crea automáticamente categorías genéricas basadas en tus hábitos (Líquidos, Gaming, Aseo, etc) con subcategorías pre-configuradas.
              </p>
              <button
                onClick={handleInitCategories}
                disabled={initializing}
                className="w-full rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white transition-all hover:bg-zinc-200 dark:hover:bg-white/10 active:scale-95 disabled:opacity-50"
              >
                {initializing ? 'Creando...' : 'Inicializar Categorías Recomendadas'}
              </button>
            </div>
            
            {user?.email === 'bfrancosentis@gmail.com' && (
              <div className="mt-8 pt-4 border-t border-red-100 dark:border-red-900/30">
                <h3 className="text-[13px] font-semibold text-red-600 dark:text-red-400 mb-2">Zona de Administrador</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-3">
                  Si creaste registros, reglas o categorías antes de tener sistema de usuarios, pulsa este botón para asignarlos a tu cuenta actual.
                </p>
                <button
                  onClick={handleMigrate}
                  disabled={migrating}
                  className="w-full rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 transition-all hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
                >
                  {migrating ? 'Migrando...' : 'Migrar Datos Antiguos a esta Cuenta'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
