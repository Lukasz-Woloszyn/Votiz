import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Calendar, Eye, EyeOff } from 'lucide-react';
import api from './api';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPollCreated: () => void;
}

export default function CreatePollModal({ isOpen, onClose, onPollCreated }: CreatePollModalProps) {
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState(['', '']);
  
  // Data zakończenia (String z inputa: YYYY-MM-DDTHH:mm)
  const [deadline, setDeadline] = useState('');
  // Data MINIMALNA (do blokady kalendarza)
  const [minDateTime, setMinDateTime] = useState('');
  
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // 1. Pobieramy "chamski" czas lokalny w formacie ISO-podobnym
      const now = new Date();
      // Trick: formatujemy datę lokalną tak, żeby pasowała do inputa
      // np. "2023-10-27T17:35"
      const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      
      setMinDateTime(localIso);

      // 2. Domyślna data: Jutro
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowIso = new Date(tomorrow.getTime() - (tomorrow.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      
      setDeadline(tomorrowIso);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!title.trim()) { setError("Tytuł jest wymagany."); return; }
    if (options.some(o => !o.trim())) { setError("Wszystkie opcje muszą być wypełnione."); return; }
    if (!deadline) { setError("Wybierz datę zakończenia."); return; }
    if (deadline < minDateTime) { setError("Nie możesz ustawić daty z przeszłości!"); return; }

    setLoading(true);

    try {
      // --- KLUCZOWA ZMIANA ---
      // Nie używamy new Date(deadline).toISOString() bo to zmienia czas na UTC!
      // Wysyłamy dokładnie to, co jest w inpucie, dodając sekundy.
      // Format: "2023-10-27T17:00:00" (Czas LOKALNY)
      const payloadDate = deadline + ":00";

      await api.post('/polls/', {
        title: title,
        options: options,
        expires_at: payloadDate, // Wysyłamy lokalny string
        results_visible_live: isPublic
      });

      setTitle('');
      setOptions(['', '']);
      setIsPublic(true);
      onPollCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.data) {
        const data = err.response.data;
        if (data.detail && Array.isArray(data.detail)) {
            const firstError = data.detail[0];
            const fieldName = firstError.loc[firstError.loc.length - 1]; 
            setError(`Błąd pola "${fieldName}": ${firstError.msg}`);
        } else if (data.detail) {
            setError(data.detail);
        } else {
            setError("Wystąpił nieznany błąd serwera.");
        }
      } else {
        setError("Błąd połączenia z serwerem.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white sticky top-0 z-10">
          <h2 className="text-lg font-bold">Nowa Ankieta</h2>
          <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200 animate-pulse">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Pytanie / Tytuł <span className="text-gray-400 text-xs">({title.length}/150)</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={150}
              placeholder="Np. Gdzie idziemy na lunch?"
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Opcje odpowiedzi</label>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-3 group">
                  <div className="relative flex-1">
                    <input
                      value={opt}
                      onChange={e => handleOptionChange(idx, e.target.value)}
                      maxLength={100}
                      placeholder={`Opcja ${idx + 1}`}
                      className="w-full p-2.5 pr-16 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm shadow-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none bg-white/80 px-1 rounded">
                      {opt.length}/100
                    </span>
                  </div>
                  {options.length > 2 && (
                    <button type="button" onClick={() => removeOption(idx)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-60 group-hover:opacity-100" tabIndex={-1}>
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button type="button" onClick={addOption} className="mt-3 w-full py-2 border-2 border-dashed border-blue-100 text-blue-600 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition font-medium flex items-center gap-2 justify-center">
                <Plus size={18} /> Dodaj kolejną opcję
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                 <Calendar size={16}/> Koniec głosowania
              </label>
              <input 
                type="datetime-local"
                min={minDateTime}
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm cursor-pointer"
              />
            </div>
            <div className="flex items-end pb-2">
               <label className="flex items-center gap-3 cursor-pointer group w-full p-2 rounded-lg hover:bg-gray-50 transition border border-transparent hover:border-gray-200">
                  <div className="relative flex items-center">
                    <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-300 shadow-sm transition-all checked:border-blue-600 checked:bg-blue-600 hover:shadow-md"/>
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </span>
                  </div>
                  <div className="flex flex-col select-none">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                       {isPublic ? <Eye size={16}/> : <EyeOff size={16}/>} Wyniki na żywo
                    </span>
                    <span className="text-xs text-gray-400">{isPublic ? "Widoczne dla wszystkich" : "Ukryte do końca czasu"}</span>
                  </div>
               </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition">Anuluj</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-70">
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Utwórz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}