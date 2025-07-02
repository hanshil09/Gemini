// firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('./firebaseData.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://fooddatastore-8adae-default-rtdb.firebaseio.com'
});

module.exports = admin;