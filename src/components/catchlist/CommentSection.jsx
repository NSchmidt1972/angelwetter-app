import { useEffect, useRef, useState } from 'react';
import { addComment, deleteComment as delComment, listComments } from '../../services/comments';

export default function CommentSection({ entryId, anglerName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState('');
  const sectionRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => { if (sectionRef.current && !sectionRef.current.contains(e.target)) onClose?.(); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await listComments(entryId);
      if (!cancelled) {
        if (error) console.error('Kommentare laden:', error);
        setComments(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entryId]);

  const add = async () => {
    const text = input.trim();
    if (!text) return;
    const optimistic = { id: `tmp-${Date.now()}`, fish_id: entryId, user_name: anglerName, text };
    setComments(prev => [...prev, optimistic]);
    setInput('');
    const { error } = await addComment({ fish_id: entryId, user_name: anglerName, text });
    if (error) console.error('Kommentar hinzufügen:', error);
  };

  const remove = async (id) => {
    if (!confirm('Diesen Kommentar wirklich löschen?')) return;
    setComments(prev => prev.filter(c => c.id !== id));
    const { error } = await delComment(id);
    if (error) console.error('Kommentar löschen:', error);
  };

  return (
    <div ref={sectionRef} className="mt-3 space-y-2">
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-1">
          {comments.map(c => (
            <div key={c.id} className="flex justify-between items-center text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
              <span><strong>{c.user_name}:</strong> {c.text}</span>
              {c.user_name === anglerName && (
                <button onClick={() => remove(c.id)} className="text-red-500 hover:text-red-700 ml-2">❌</button>
              )}
            </div>
          ))}
          {!comments.length && <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine Kommentare.</p>}
        </div>
      )}
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Kommentar hinzufügen..." className="flex-1 border rounded px-2 py-1" />
        <button onClick={add} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded">➤</button>
      </div>
    </div>
  );
}
