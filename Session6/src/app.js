const express = require('express');
const menuRoutes = require('./routes/menu');
const membersRoutes = require('./routes/members');
const ordersRoutes = require('./routes/orders');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      message: 'Invalid JSON in request body. Use double quotes for keys and values, and close with } not }\'',
    });
  }
  next(err);
});

app.use('/api/menu', menuRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/orders', ordersRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
