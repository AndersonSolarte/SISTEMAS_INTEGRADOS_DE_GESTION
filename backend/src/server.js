require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { testConnection } = require('./config/database');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(morgan('dev'));
app.use(compression());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/documentos', require('./routes/documentoRoutes'));
app.use('/api', require('./routes/catalogoRoutes'));
app.use('/api/import', require('./routes/importRoutes'));

app.get('/api/health', (req, res) => res.json({ success: true, status: 'OK' }));

const PORT = process.env.PORT || 5000;

testConnection().then(() => {
  app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║  🚀 Servidor SGC iniciado             ║');
    console.log(`║  🌐 Puerto: ${PORT}                      ║`);
    console.log('╚════════════════════════════════════════╝');
  });
});