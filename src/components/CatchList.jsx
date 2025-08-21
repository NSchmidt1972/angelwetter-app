import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// Utils
function getMoonDescription(phase) {
  if (phase === 0 || phase === 1) return '🌑 Neumond';
  if (phase < 0.25) return '🌒 zunehmend';
  if (phase === 0.25) return '🌓 erstes Viertel';
  if (phase < 0.5) return '🌔 zunehmend';
  if (phase === 0.5) return '🌕 Vollmond';
  if (phase < 0.75) return '🌖 abnehmend';
  if (phase === 0.75) return '🌗 letztes Viertel';
  return '🌘 abnehmend';
}
function windDirection(deg) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
const FISH_TYPES = ['Aal','Barsch','Brasse','Hecht','Karpfen','Rotauge','Rotfeder','Schleie','Wels','Zander'];

const PAGE_SIZE = 20;
const CACHE_KEY = 'catchlist_cache_v2';
const PUBLIC_FROM = new Date('2025-06-01');
const VERTRAUTE = ['Nicol Schmidt', 'Laura Rittlinger'];

// -------- Kommentare (on demand) --------
function CommentSection({ entryId, anglerName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState('');
  const sectionRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (sectionRef.current && !sectionRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('fish_id', entryId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) console.error('Kommentare laden:', error);
      setComments(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entryId]);

  const addComment = async () => {
    const text = input.trim();
    if (!text) return;
    const optimistic = { id: `tmp-${Date.now()}`, fish_id: entryId, user_name: anglerName, text };
    setComments(prev => [...prev, optimistic]);
    setInput('');
    const { error } = await supabase.from('comments').insert([{ fish_id: entryId, user_name: anglerName, text }]);
    if (error) console.error('Kommentar hinzufügen:', error);
  };
  const deleteComment = async (id) => {
    if (!confirm('Diesen Kommentar wirklich löschen?')) return;
    setComments(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) console.error('Kommentar löschen:', error);
  };

  return (
    <div ref={sectionRef} className="mt-3 space-y-2">
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {comments.map(c => (
            <div key={c.id} className="flex justify-between items-center text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
              <span><strong>{c.user_name}:</strong> {c.text}</span>
              {c.user_name === anglerName && (
                <button onClick={() => deleteComment(c.id)} className="text-red-500 hover:text-red-700 ml-2">❌</button>
              )}
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine Kommentare.</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Kommentar hinzufügen..."
          className="flex-1 border rounded px-2 py-1"
        />
        <button onClick={addComment} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded">➤</button>
      </div>
    </div>
  );
}

// -------- Hauptliste --------
export default function CatchList({ anglerName }) {
  const [catches, setCatches] = useState([]);
  const [onlyMine, setOnlyMine] = useState(false);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [modalPhoto, setModalPhoto] = useState(null);
  const [openCommentsId, setOpenCommentsId] = useState(null);

  const [likesData, setLikesData] = useState({});
  const [userLikes, setUserLikes] = useState(new Set());
  const [pendingLikes, setPendingLikes] = useState(new Set());

  const [totalCount, setTotalCount] = useState(null);

  const isTrusted = useMemo(() => VERTRAUTE.includes(anglerName), [anglerName]);
  const baseSelect =
    'id, angler, fish, size, weight, note, timestamp, weather, photo_url, location_name, is_marilou, blank';

  // Optional: sofort Cache zeigen (nicht blockierend)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items) && parsed.items.length) {
          setCatches(parsed.items);
        }
      }
    } catch { /* noop */ }
    // frischer Reset; Fetch läuft über den page-Effect unten
    setLoading(true);
    setHasMore(true);
    setPage(0);
  }, []); // nur 1x beim Mount

  // Serverseitige Basifilter
  const applyServerFilters = useCallback((q) => {
    q = q.eq('blank', false).neq('is_marilou', true);
    if (onlyMine) q = q.eq('angler', anglerName);
    return q;
  }, [onlyMine, anglerName]);

  // Likes für sichtbare IDs nachladen
  const loadLikesFor = useCallback(async (ids) => {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return;
    const { data, error } = await supabase
      .from('likes')
      .select('fish_id, user_name')
      .in('fish_id', unique);
    if (error) { console.error('Likes laden:', error); return; }

    const map = {};
    const mine = new Set();
    data.forEach(l => {
      map[l.fish_id] = (map[l.fish_id] || 0) + 1;
      if (l.user_name === anglerName) mine.add(l.fish_id);
    });
    setLikesData(prev => ({ ...prev, ...map }));
    setUserLikes(prev => {
      const ns = new Set(prev);
      mine.forEach(id => ns.add(id));
      return ns;
    });
  }, [anglerName]);

  // 🔄 Seite laden – gesteuert NUR über `page`, `onlyMine`, `anglerName`
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from('fishes')
        .select(baseSelect)
        .order('timestamp', { ascending: false })
        .range(from, to);
      q = applyServerFilters(q);

      const { data, error } = await q;
      if (cancelled) return;

      if (error) {
        console.error('Fänge laden:', error);
        setLoading(false);
        return;
      }

      // clientseitige Rest-Filter (Öffentlich/Vertraute, Lobberich)
      const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';
      const filtered = (data || []).filter(f => {
        const fangDatum = new Date(f.timestamp);
        const istEigenerFang = f.angler === anglerName;

        if (!isTrusted) {
          if (fangDatum < PUBLIC_FROM) return false;
        } else {
          if (filterSetting !== 'all' && fangDatum < PUBLIC_FROM) return false;
        }

        const ort = f.location_name?.toLowerCase().trim() ?? '';
        const ortIstLobberich = f.location_name == null || ort.includes('lobberich');
        return onlyMine ? istEigenerFang : ortIstLobberich;
      });

      setCatches(prev => (page === 0 ? filtered : [...prev, ...filtered]));
      setHasMore((data || []).length === PAGE_SIZE);
      setLoading(false);

      // Cache erste Seite aktualisieren
      if (page === 0) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ items: filtered, hasMore: true })); } catch { /* noop */ }
      }

      // Likes für neue Items
      await loadLikesFor(filtered.map(i => i.id));
    })();

    return () => { cancelled = true; };
  }, [page, onlyMine, anglerName, isTrusted, baseSelect, applyServerFilters, loadLikesFor]);

  // 📊 Gesamtanzahl mit identischen Filtern (ohne Paging)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';
      const istVertrauter = VERTRAUTE.includes(anglerName);

      let q = supabase
        .from('fishes')
        .select('*', { count: 'exact', head: true })
        .eq('blank', false)
        .neq('is_marilou', true);

      if (onlyMine) {
        q = q.eq('angler', anglerName);
      } else {
        q = q.or('location_name.is.null,location_name.ilike.%lobberich%');
      }

      if (!istVertrauter || filterSetting !== 'all') {
        q = q.gte('timestamp', new Date('2025-06-01').toISOString());
      }

      const { count, error } = await q;
      if (cancelled) return;
      if (error) { console.error('Gesamtanzahl laden:', error); setTotalCount(null); return; }
      setTotalCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [onlyMine, anglerName]);

  // ♾️ Infinite Scroll: Sentinel erhöht nur die Seite (keine Datenlogik hier)
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        // Schutz: nicht während eines laufenden Fetches hochzählen
        if (!loading) setPage(p => p + 1);
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading]);

  // 🔔 Realtime Likes (unverändert)
  useEffect(() => {
    const likesSub = supabase
      .channel('likes-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {
        const like = payload.new;
        setLikesData(prev => ({ ...prev, [like.fish_id]: (prev[like.fish_id] || 0) + 1 }));
        if (like.user_name === anglerName) setUserLikes(prev => new Set([...prev, like.fish_id]));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'likes' }, (payload) => {
        const like = payload.old;
        setLikesData(prev => ({ ...prev, [like.fish_id]: Math.max((prev[like.fish_id] || 1) - 1, 0) }));
        if (like.user_name === anglerName) setUserLikes(prev => { const ns = new Set(prev); ns.delete(like.fish_id); return ns; });
      })
      .subscribe();
    return () => { supabase.removeChannel(likesSub); };
  }, [anglerName]);

  // 👍 Like toggeln (optimistisch)
  const toggleLike = async (fishId) => {
    if (pendingLikes.has(fishId)) return;
    setPendingLikes(prev => new Set(prev).add(fishId));
    if (userLikes.has(fishId)) {
      setLikesData(prev => ({ ...prev, [fishId]: Math.max((prev[fishId] || 1) - 1, 0) }));
      setUserLikes(prev => { const ns = new Set(prev); ns.delete(fishId); return ns; });
      const { error } = await supabase.from('likes').delete().eq('fish_id', fishId).eq('user_name', anglerName);
      if (error) { setLikesData(prev => ({ ...prev, [fishId]: (prev[fishId] || 0) + 1 })); setUserLikes(prev => new Set(prev).add(fishId)); }
    } else {
      setLikesData(prev => ({ ...prev, [fishId]: (prev[fishId] || 0) + 1 }));
      setUserLikes(prev => new Set(prev).add(fishId));
      const { error } = await supabase.from('likes').insert([{ fish_id: fishId, user_name: anglerName }]);
      if (error) { setLikesData(prev => ({ ...prev, [fishId]: Math.max((prev[fishId] || 1) - 1, 0) })); setUserLikes(prev => { const ns = new Set(prev); ns.delete(fishId); return ns; }); }
    }
    setPendingLikes(prev => { const ns = new Set(prev); ns.delete(fishId); return ns; });
  };

  // ✍️ Editieren/Löschen/Foto
  const [editingEntry, setEditingEntry] = useState(null);
  const [editFish, setEditFish] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handlePhotoChange = e => {
    const file = e.target.files[0];
    setEditPhotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };
  const handleUpdate = async () => {
    if (!editFish || !editSize) { alert('Bitte Fischart und Größe angeben.'); return; }
    let photoUrl = editingEntry.photo_url;
    if (editPhotoFile) {
      const ext = editPhotoFile.name.split('.').pop();
      const path = `${editingEntry.id}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('fischfotos').upload(path, editPhotoFile, { upsert: true });
      if (uploadError) { console.error('Upload-Fehler:', uploadError); alert('Fehler beim Hochladen.'); return; }
      const { data: publicUrlData } = supabase.storage.from('fischfotos').getPublicUrl(path);
      photoUrl = publicUrlData.publicUrl;
    }
    const { error } = await supabase.from('fishes').update({ fish: editFish, size: parseFloat(editSize), note: editNote, photo_url: photoUrl }).eq('id', editingEntry.id);
    if (error) { console.error('Update-Fehler:', error); alert('Fehler beim Speichern.'); return; }
    setCatches(prev => prev.map(c => c.id === editingEntry.id ? { ...c, fish: editFish, size: parseFloat(editSize), note: editNote, photo_url: photoUrl } : c));
    setEditingEntry(null); setPreviewUrl(null);
  };
  const handleDelete = async (id) => {
    if (!confirm('Bist du sicher, dass du diesen Fang löschen möchtest?')) return;
    const { error } = await supabase.from('fishes').delete().eq('id', id);
    if (error) { console.error('Löschen:', error); alert('Fehler beim Löschen.'); return; }
    setCatches(prev => prev.filter(f => f.id !== id));
    setTotalCount(tc => (typeof tc === 'number' ? Math.max(tc - 1, 0) : tc));
  };

  // Render-Helfer
  const getLocationDisplay = (entry) => {
    const ort = entry.location_name?.toLowerCase().trim() ?? '';
    if (!ort || ort.includes('lobberich')) return '';
    return `📍 ${entry.location_name}`;
  };
  const SkeletonCard = () => (
    <li className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-md animate-pulse">
      <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
      <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-6 w-full bg-gray-200 dark:bg-gray-700 rounded" />
    </li>
  );

  // Share
  async function handleShare(entry) {
    const FISH_ARTICLES = { Aal:'einen', Barsch:'einen', Brasse:'eine', Hecht:'einen', Karpfen:'einen', Rotauge:'ein', Rotfeder:'eine', Schleie:'eine', Wels:'einen', Zander:'einen' };
    const date = new Date(entry.timestamp).toLocaleDateString('de-DE');
    const time = new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const w = entry.weather || {};
    const article = FISH_ARTICLES[entry.fish] || 'einen';
    const shareText = `🎣 Ich habe am ${date} um ${time} ${article} ${entry.fish} gefangen!\n📏 Größe: ${entry.size} cm\n🌡 Wetter: ${w?.temp ?? '?'} °C, ${w?.description ?? 'unbekannt'}\n💨 Wind: ${w?.wind ?? '?'} m/s${w?.wind_deg !== undefined ? ` aus ${windDirection(w.wind_deg)}` : ''}\n🧪 Luftdruck: ${w?.pressure ?? '?'} hPa • 💦 Feuchte: ${w?.humidity ?? '?'} %\n🌙 Mond: ${getMoonDescription(w?.moon_phase)}`;
    try {
      let files = [];
      if (entry.photo_url) {
        const resp = await fetch(entry.photo_url);
        const blob = await resp.blob();
        files = [new File([blob], 'fangfoto.jpg', { type: blob.type })];
      }
      await navigator.share({ title: 'Mein Fang', text: shareText, files });
    } catch (err) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return;
      try { await navigator.clipboard.writeText(shareText); alert('📋 Fanginfo kopiert!'); }
      catch { alert('Teilen nicht unterstützt.'); }
    }
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <div className="space-y-6 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-700 dark:text-blue-400">🎣 Fangliste</h2>

        <div className="flex justify-between items-center mb-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            🎯 {onlyMine ? 'Meine' : 'Gesamt'}: {totalCount ?? '…'} {(totalCount === 1 ? 'Fang' : 'Fänge')}
            {/*{typeof totalCount === 'number' && (
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">• {catches.length} geladen</span>
            )}*/}
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="accent-blue-600" />
            Nur meine
          </label>
        </div>

        {loading && catches.length === 0 && (
          <ul className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </ul>
        )}

        {!loading && catches.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-6">Keine Fänge gespeichert.</p>
        )}

        <ul className="space-y-6">
          {catches.map(entry => {
            const d = new Date(entry.timestamp);
            const dateStr = d.toLocaleDateString('de-DE');
            const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

            return (
              <li key={entry.id} className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-md">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{dateStr} – {timeStr} {getLocationDisplay(entry)}</p>
                  {entry.angler === anglerName && (
                    <div className="relative">
                      <button onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)} className="text-xl hover:text-blue-600">⋮</button>
                      {openMenuId === entry.id && (
                        <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow z-10">
                          <button
                            onClick={() => { setEditingEntry(entry); setEditFish(entry.fish); setEditSize(entry.size); setEditNote(entry.note || ''); }}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                          >Bearbeiten</button>
                          <button
                            onClick={() => { if (confirm('Bist du sicher, dass du diesen Fang löschen möchtest?')) handleDelete(entry.id); setOpenMenuId(null); }}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >Löschen</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{entry.angler}</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600 font-medium">{entry.fish}</span>
                  <span>{`${entry.size} cm`}</span>
                  {entry.fish?.toLowerCase() === 'karpfen' && entry.weight != null && (
                    <span className="text-sm italic">({entry.weight} kg)</span>
                  )}
                  {entry.photo_url && (
                    <button onClick={() => setModalPhoto(entry.photo_url)} className="ml-auto">
                      <img src={entry.photo_url} alt="Fangfoto" loading="lazy" decoding="async" className="w-16 h-16 rounded-full object-cover shadow" />
                    </button>
                  )}
                </div>

                {entry.note && (
                  <p className="italic text-sm text-gray-600 dark:text-gray-300 mb-2">{entry.note}</p>
                )}

                {entry.weather && (
                  <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                    <div className="flex items-center gap-2">
                      {entry.weather.icon && (
                        <img src={`https://openweathermap.org/img/wn/${entry.weather.icon}@2x.png`} alt={entry.weather.description} loading="lazy" decoding="async" className="w-12 h-12" />
                      )}
                      <div>
                        <p>{`${entry.weather.temp} °C, ${entry.weather.description}`}</p>
                        <p>💨 {`${entry.weather.wind} m/s`} aus {windDirection(entry.weather.wind_deg)} ({entry.weather.wind_deg}°)</p>
                        <p>💦 {entry.weather.humidity}% • 🧪 {entry.weather.pressure} hPa</p>
                        <p>{getMoonDescription(entry.weather.moon_phase)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2 justify-end">
                 {/* <button onClick={() => toggleLike(entry.id)} disabled={pendingLikes.has(entry.id)} className={`px-2 py-1 rounded ${userLikes.has(entry.id) ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    👍 {likesData[entry.id] || 0}
                  </button>

                  <button onClick={() => setOpenCommentsId(openCommentsId === entry.id ? null : entry.id)} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700">
                    💬
                  </button>*/}

                  {entry.angler === anglerName && (
                    <button onClick={() => handleShare(entry)} className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition">
                      📤 Teilen
                    </button>
                  )}
                </div>

                {openCommentsId === entry.id && (
                  <CommentSection entryId={entry.id} anglerName={anglerName} onClose={() => setOpenCommentsId(null)} />
                )}
              </li>
            );
          })}
        </ul>

        {hasMore && <div ref={sentinelRef} className="py-6 text-center text-sm text-gray-400">Mehr laden…</div>}

        {/* Editor-Modal */}
        {editingEntry && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-blue-700 dark:text-blue-400">🎣 Fang bearbeiten</h2>
              <div className="space-y-4">
                <select value={editFish} onChange={e => setEditFish(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="">Fischart auswählen</option>
                  {FISH_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                </select>
                <input type="number" placeholder="Größe (cm)" value={editSize} onChange={e => setEditSize(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                <textarea placeholder="Kommentar (optional)" value={editNote} onChange={e => setEditNote(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                <div>
                  <label className="block text-sm font-medium mb-1">Neues Foto hochladen (optional):</label>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-gray-900 dark:text-gray-100" />
                  {previewUrl && (<div className="mt-3"><img src={previewUrl} alt="Vorschau" className="rounded shadow max-h-48 mx-auto" /></div>)}
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setEditingEntry(null); setPreviewUrl(null); }} className="px-4 py-2 border border-gray-400 dark:border-gray-500 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Abbrechen</button>
                  <button onClick={handleUpdate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Speichern</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Foto-Modal */}
        {modalPhoto && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setModalPhoto(null)}>
            <img src={modalPhoto} alt="Fangfoto groß" className="max-w-[90vw] max-h-[80vh] rounded-md shadow-lg cursor-pointer" />
          </div>
        )}
      </div>
    </div>
  );
}
