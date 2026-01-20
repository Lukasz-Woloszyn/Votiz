import { useState, useEffect } from 'react';
import api from './api';
import { Lock, Unlock, CheckCircle, PlusCircle, Trash2, LogOut, User, Users, Copy, Square } from 'lucide-react';
import CreatePollModal from './CreatePollModal';
import PollTimer from './PollTimer';

interface Option {
  id: number;
  text: string;
  vote_count: number;
}

interface Poll {
  id: number;
  title: string;
  owner_id: number;
  expires_at: string;
  results_visible_live: boolean;
  options: Option[];
  user_voted: boolean;
  is_active: boolean;
  invite_code: string;
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userId, setUserId] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [view, setView] = useState<'login' | 'polls'>('login');
  const [activeTab, setActiveTab] = useState<'my' | 'joined'>('my');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      setView('polls');
      fetchUserData();
      
      const interval = setInterval(() => {
        fetchPolls(false);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const parseError = (e: any) => {
    if (e.response && e.response.data) {
      const data = e.response.data;
      if (data.detail && Array.isArray(data.detail)) {
        return data.detail[0].msg;
      }
      if (data.detail && typeof data.detail === 'string') {
        return data.detail;
      }
    }
    return "Wystąpił nieznany błąd.";
  };
  
  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showNotification(`Skopiowano kod: ${text}`);
    });
  };

  const fetchUserData = async () => {
    try {
      const userRes = await api.get('/users/me');
      setUserId(userRes.data.id);
      fetchPolls();
    } catch (e) {
      logout();
    }
  };

  const login = async () => {
    if (!email.includes('@')) {
      alert("Wpisz poprawny adres email!");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);
      
      const res = await api.post('/token', formData);
      localStorage.setItem('token', res.data.access_token);
      setToken(res.data.access_token);
    } catch (e) {
      alert("Błąd logowania: " + parseError(e)); 
    }
  };

  const register = async () => {
    if (!email.includes('@')) {
      alert("To nie jest poprawny email.");
      return;
    }
    if (password.length < 8) {
      alert("Hasło jest za krótkie (min. 8 znaków).");
      return;
    }

    try {
      await api.post('/register', { email: email, password: password });
      alert("Konto utworzone! Możesz się zalogować.");
      setPassword(''); 
    } catch (e) {
      alert("Błąd rejestracji: " + parseError(e));
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUserId(null);
    setView('login');
  };

  const fetchPolls = async (showError = true) => {
    try {
      const res = await api.get('/polls/');
      const sorted = res.data.sort((a: Poll, b: Poll) => b.id - a.id);
      setPolls(sorted);
    } catch (e) {
      if (showError) console.error(e);
    }
  };

  const vote = async (pollId: number, optionId: number) => {
    try {
      await api.post('/vote/', { poll_id: pollId, option_id: optionId });
      fetchPolls(); 
      showNotification("Głos oddany!");
    } catch (e) {
      alert("Nie udało się oddać głosu.");
    }
  };

  const endPoll = async (pollId: number) => {
    if (!window.confirm("Czy na pewno chcesz zakończyć ankietę przed czasem? To odsłoni wyniki i zablokuje głosowanie.")) return;
    try {
      await api.patch(`/polls/${pollId}/end`);
      fetchPolls();
      showNotification("Ankieta zakończona pomyślnie.");
    } catch (e) {
      alert("Błąd podczas kończenia ankiety.");
    }
  };

  const deletePoll = async (pollId: number) => {
    if (!window.confirm("Usunąć ankietę trwale?")) return;
    try {
      await api.delete(`/polls/${pollId}`);
      setPolls(polls.filter(p => p.id !== pollId)); 
      showNotification("Ankieta usunięta.");
    } catch (e) {
      alert("Błąd usuwania.");
    }
  };

  const leavePoll = async (pollId: number) => {
    if (!window.confirm("Czy chcesz opuścić tę ankietę?")) return;
    try {
      await api.delete(`/polls/${pollId}/leave`);
      setPolls(polls.filter(p => p.id !== pollId)); 
      showNotification("Opuszczono ankietę.");
    } catch (e) {
      alert("Błąd opuszczania ankiety.");
    }
  }

  const joinPoll = async () => {
    if (inviteCode.trim().length === 0) return;

    try {
      await api.post('/join/', { invite_code: inviteCode });
      showNotification("Sukces! Dołączono do nowej ankiety.");
      fetchPolls(); 
      setActiveTab('joined');
      setInviteCode('');
    } catch (e: any) {
      if (e.response) {
        if (e.response.status === 409) {
            showNotification("Bierzesz już udział w tej ankiecie.");
            setInviteCode('');
        } else if (e.response.status === 400) {
            alert(e.response.data.detail);
        } else if (e.response.status === 404) {
            alert("Nie znaleziono ankiety z takim kodem.");
        } else {
            alert("Wystąpił błąd.");
        }
      }
    }
  };

  const myPolls = polls.filter(p => p.owner_id === userId);
  const joinedPolls = polls.filter(p => p.owner_id !== userId);
  const displayedPolls = activeTab === 'my' ? myPolls : joinedPolls;

  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-lg w-96">
          <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">Votiz</h1>
          
          <label className="block text-sm font-medium text-gray-700 mb-1">Adres Email</label>
          <input 
            type="email"
            className="w-full p-3 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="twoj@email.com" 
            value={email} onChange={e => setEmail(e.target.value)} 
          />
          
          <label className="block text-sm font-medium text-gray-700 mb-1">Hasło</label>
          <input 
            className="w-full p-3 mb-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Hasło" type="password"
            value={password} onChange={e => setPassword(e.target.value)}
            minLength={8}
            title="Hasło musi mieć: 8 znaków, wielką literę, cyfrę i znak specjalny."
          />
          <p className="text-xs text-gray-500 mb-6 leading-tight">
            Wymagania hasła: <span className="font-bold">min. 8 znaków, Duża Litera, cyfra,</span><br></br>
            <span className="font-bold">znak specjalny (!@#$...).</span>
          </p>
          
          <div className="flex gap-2">
            <button onClick={login} className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition">Zaloguj</button>
            <button onClick={register} className="flex-1 bg-gray-200 text-gray-700 p-2 rounded hover:bg-gray-300 transition">Rejestracja</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      
      {notification && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-5">
           <CheckCircle size={20} className="text-green-400"/>
           {notification}
        </div>
      )}

      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
            <CheckCircle /> Votiz
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
              <PlusCircle size={18}/> Nowa Ankieta
            </button>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500 font-medium">Wyloguj</button>
          </div>
        </div>
      </nav>
      
      <div className="max-w-2xl mx-auto px-4 mt-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-2 items-center">
          <input 
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            placeholder="Kod zaproszenia..."
            maxLength={6}
            className="flex-1 p-2 border border-gray-300 rounded outline-none focus:border-blue-500"
          />
          <button onClick={joinPoll} className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900 font-medium">Dołącz</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-8">
        <div className="flex border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('my')}
            className={`flex-1 py-3 text-center font-medium flex justify-center items-center gap-2 ${activeTab === 'my' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <User size={18}/> Moje Ankiety ({myPolls.length})
          </button>
          <button 
            onClick={() => setActiveTab('joined')}
            className={`flex-1 py-3 text-center font-medium flex justify-center items-center gap-2 ${activeTab === 'joined' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users size={18}/> Udostępnione dla mnie ({joinedPolls.length})
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-6 px-4 mt-6">
        {displayedPolls.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p>Brak ankiet w tej kategorii.</p>
          </div>
        ) : (
          displayedPolls.map(poll => (
            <div key={poll.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 transition hover:shadow-lg relative">  
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  {/* Tytuł, Kod, Kłódka */}
                  <div className="flex-1 pr-4">
                    <h3 className="text-xl font-bold text-gray-800 break-all mb-2 leading-tight">
                      {poll.title}
                    </h3>
                    
                    <div className="flex flex-wrap gap-3 items-center">
                      {/* Kod */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(poll.invite_code); }}
                        className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold tracking-wider hover:bg-blue-100 hover:text-blue-600 transition flex items-center gap-1 group"
                        title="Kliknij, aby skopiować kod"
                      >
                         Kod: {poll.invite_code} <Copy size={12} className="opacity-50 group-hover:opacity-100 transition-opacity"/>
                      </button>

                      {/* Status Wyników */}
                      <span 
                        title={poll.results_visible_live ? "Wyniki publiczne" : "Wyniki ukryte"} 
                        className={`flex items-center gap-1 text-xs font-medium ${poll.results_visible_live ? "text-gray-400" : "text-orange-500"}`}
                      >
                        {poll.results_visible_live ? <Unlock size={14} /> : <Lock size={14} />}
                        <span className="hidden sm:inline">{poll.results_visible_live ? "Publiczne" : "Ukryte"}</span>
                      </span>
                    </div>
                  </div>

                  {/* Czas, Stop, Kosz */}
                  <div className="flex items-center gap-3 shrink-0">
                    
                    {poll.is_active ? (
                       <PollTimer expiresAt={poll.expires_at} onExpire={() => fetchPolls()} />
                    ) : (
                       <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded flex items-center gap-1 font-medium text-xs">
                         ZAKOŃCZONA
                       </span>
                    )}

                    {poll.owner_id === userId ? (
                      <div className="flex items-center gap-2">
                        {/* Stop - zatrzymaj ankietę */}
                        {poll.is_active && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); endPoll(poll.id); }}
                            className="text-gray-300 hover:text-blue-600 transition p-1 hover:bg-blue-50 rounded"
                            title="Zakończ ankietę teraz"
                          >
                            <Square size={20} fill="currentColor" />
                          </button>
                        )}
                        {/* Usuń ankietę */}
                        <button 
                          onClick={(e) => { e.stopPropagation(); deletePoll(poll.id); }}
                          className="text-gray-300 hover:text-red-500 transition p-1 hover:bg-red-50 rounded"
                          title="Usuń ankietę trwale"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ) : (
                      /* Opuść ankietę - gość */
                      <button 
                        onClick={(e) => { e.stopPropagation(); leavePoll(poll.id); }}
                        className="text-gray-300 hover:text-orange-500 transition p-1 hover:bg-orange-50 rounded"
                        title="Opuść ankietę"
                      >
                        <LogOut size={20} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Opcje */}
                <div className="space-y-3">
                  {poll.options.map(option => {
                    const showResults = poll.user_voted || !poll.is_active;
                    const isHidden = option.vote_count === -1;
                    const totalVotes = poll.options.reduce((acc, o) => acc + (o.vote_count === -1 ? 0 : o.vote_count), 0);
                    const percent = totalVotes === 0 || isHidden ? 0 : Math.round((option.vote_count / totalVotes) * 100);

                    return (
                      <div key={option.id} className="relative group">
                        {/* Tło postępu */}
                        {showResults && !isHidden && (
                          <div 
                            className="absolute left-0 top-0 bottom-0 bg-blue-100 rounded-lg transition-all duration-500 opacity-60" 
                            style={{ width: `${percent}%` }}
                          ></div>
                        )}
                        
                        <button
                          onClick={() => !poll.user_voted && poll.is_active && vote(poll.id, option.id)}
                          disabled={poll.user_voted || !poll.is_active}
                          className={`relative w-full p-3 rounded-lg border text-left flex justify-between items-center transition-all z-10 h-auto min-h-[50px]
                          ${(poll.user_voted || !poll.is_active)
                            ? 'border-transparent cursor-default'
                            : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                          }`}
                        >
                          <span className="font-medium text-gray-700 break-words max-w-[75%] relative z-10">
                            {option.text}
                          </span>
                          
                          {/* Wyświetlanie liczby głosów */}
                          <span className="text-sm font-bold text-gray-600 tabular-nums relative z-10">
                            {showResults 
                              ? (isHidden ? '?' : `${option.vote_count} (${percent}%)`) 
                              : ''}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                {poll.user_voted && (
                  <div className="mt-4 text-xs text-gray-400 text-center font-medium">
                    Twój głos został oddany. Dziękujemy!
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <CreatePollModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onPollCreated={() => { fetchPolls(); setActiveTab('my'); }} />
    </div>
  );
}

export default App;