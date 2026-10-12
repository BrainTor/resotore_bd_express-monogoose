const express = require('express');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const app = express();
app.use(express.json());

const mongoose = require('mongoose');
const { EJSON } = require('bson');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  mongoose.connect(process.env.MONGODB_URL).then(() => {
    console.log('Connected to MongoDB');
  }).catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

});


app.get("/getCollenctionNames", async (_, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map((collection) => collection.name);
    res.json(collectionNames);
  }
  catch (error) {
    console.error('Error fetching collection names:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }}); 

async function restoreCollection(backupPath, collectionName) {
    const data = await fs.promises.readFile(backupPath, 'utf-8');

    const documents = bsonToDocuments(data);

    if (!mongoose.connection.db.collection(collectionName)) {
        await mongoose.connection.db.createCollection(collectionName);
    }

    return await mongoose.connection.db.collection(collectionName).insertMany(documents);
}

function bsonToDocuments(data) {
    const documents = typeof data === 'string' ? EJSON.parse(data) : EJSON.deserialize(data);

    if (!Array.isArray(documents)) {
        throw new Error('Backup file must contain an array of documents');
    }

    return documents;
}


app.get("/getBackupDates" , async (req, res) => {
  try {
    const path_to_backup = path.join(__dirname, 'backups');
    const backupDates = await fs.promises.readdir(path_to_backup);
    res.json(backupDates);
  }
  catch (error) {
    console.error('Error fetching backup dates:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.post("/restoreCollection", async (req, res) => {
    const { collectionName, backupDate } = req.body;

    if (!collectionName || !backupDate) {
        return res.status(400).json({ error: 'collectionName and backupDate are required' });
    }

    const path_to_backup = path.join(__dirname, 'backups', backupDate, `${collectionName}.json`);
    if (!fs.existsSync(path_to_backup)) {
        return res.status(404).json({ error: 'Backup file not found' });
    }

    try {
       await restoreCollection(path_to_backup, collectionName);
        res.json({ message: 'Collection restored successfully'});
    } catch (error) {
        console.error('Error restoring collection:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }

})