const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const interviewRoutes = require('./routes/interview');
const dashboardRoutes = require('./routes/dashboard');
const leaderboardRoutes = require('./routes/leaderboard');
const profileRoutes = require('./routes/profile');




const app = express();
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(passport.initialize());

// MongoDB connection:
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.log('MongoDB connection error:', err));
//know the syntax of both of these and last lines code in order to understand 
// how to set up a basic Express server with authentication routes and MongoDB connection.
app.get('/', (req, res) => {
  res.send('MockMate API is running');
});

// Routes
app.use('/auth', authRoutes);
app.use('/interview', interviewRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/profile', profileRoutes); 

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});