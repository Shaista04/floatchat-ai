const express = require('express');
const userRoutes = require('./routes/userRoutes');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());
const cors = require('cors')
app.use(cors())
mongoose.connect('mongodb://localhost:27017/crudDB')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Could not connect to MongoDB', err));

app.use("/", userRoutes)

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
