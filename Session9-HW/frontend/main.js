import { createStarfield } from './components/starfield.js';
import { startRouter } from './router.js';

createStarfield(document.body);

const app = document.createElement('main');
app.className = 'app-content';
document.body.appendChild(app);

startRouter(app);
