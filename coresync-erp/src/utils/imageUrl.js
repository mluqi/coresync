// Helper to prefix relative upload paths with backend origin URL
export const getImageUrl = (path) => {
  if (!path) return '';
  if (
    path.startsWith('http://') || 
    path.startsWith('https://') || 
    path.startsWith('blob:') || 
    path.startsWith('data:')
  ) {
    return path;
  }

  // Frontend public static assets (e.g. /avatars/avatar-1.svg, /favicon.ico, etc.)
  if (path.startsWith('/avatars/') || path.startsWith('avatars/')) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  const backendOrigin = apiBase.replace(/\/api\/?$/, '');

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${backendOrigin}${normalizedPath}`;
};

export default getImageUrl;
