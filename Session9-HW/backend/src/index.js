require('dotenv').config();

const http = require('http');
const app = require('./app');

// Ensure schema + bundled default stories exist on startup
require('./db/connection');
const { ensureDefaultStories } = require('./db/seed-default-stories');
const { checkStoryLibrary } = require('./startup/checkStoryLibrary');
const { attachInteractiveStoryWs } = require('./ws/interactiveStory');

ensureDefaultStories();
checkStoryLibrary();

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

attachInteractiveStoryWs(server);

server.listen(PORT, () => {
  console.log(`Lalayi API listening on http://localhost:${PORT}`);
});
