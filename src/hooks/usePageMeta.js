import { useEffect } from 'react';

export default function usePageMeta({ title, description }) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const previousTitle = document.title;
    const metaDescription =
      document.querySelector('meta[name="description"]') ||
      (() => {
        const created = document.createElement('meta');
        created.setAttribute('name', 'description');
        document.head.appendChild(created);
        return created;
      })();
    const previousDescription = metaDescription.getAttribute('content');

    if (title) {
      document.title = title;
    }
    if (typeof description === 'string' && description.trim()) {
      metaDescription.setAttribute('content', description.trim());
    }

    return () => {
      document.title = previousTitle;
      if (previousDescription == null) {
        metaDescription.removeAttribute('content');
      } else {
        metaDescription.setAttribute('content', previousDescription);
      }
    };
  }, [title, description]);
}
