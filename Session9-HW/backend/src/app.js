const express = require('express');
const path = require('path');
const cors = require('cors');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const childrenRouter = require('./routes/children');
const storiesRouter = require('./routes/stories');
const voiceProfilesRouter = require('./routes/voice-profiles');
const usageRouter = require('./routes/usage');

const app = express();
const frontendPath = path.join(__dirname, '../../frontend');
const publicPath = path.join(__dirname, '../public');

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/children', childrenRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/voice-profiles', voiceProfilesRouter);
app.use('/api/usage', usageRouter);

app.use('/audio', express.static(path.join(publicPath, 'audio')));

// Serve frontend (visit http://localhost:3001 for the app)
app.use(express.static(frontendPath));

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

module.exports = app;
