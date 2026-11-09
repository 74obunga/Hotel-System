import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../css/design-system.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find the React application root.');
}

createRoot(rootElement).render(<App />);
