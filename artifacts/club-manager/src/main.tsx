import { createRoot } from 'react-dom/client';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import App from './App';
import './index.css';

// Use empty base URL so all relative /api/... paths resolve on the same origin
setBaseUrl('');

// Inject the stored JWT as a Bearer token for every API request
setAuthTokenGetter(() => localStorage.getItem('token'));

createRoot(document.getElementById('root')!).render(<App />);
