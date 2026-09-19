// Live Sync configuration.
//
// Fill this in so multiple phones can share one tournament in real time
// (you and your coaches all seeing and entering the same scores). Leave it
// as null to keep the app working exactly as it does today: saved only to
// this device, no setup required.
//
// One-time setup (about 5 minutes):
//   1. Go to https://console.firebase.google.com and sign in with any
//      Google account. Click "Add project", give it any name, and finish
//      the wizard (you can decline Google Analytics).
//   2. On the project's home page, click the "</>" (Web) icon to register
//      a web app. Give it any nickname and click "Register app".
//   3. It shows you a firebaseConfig object. Copy it and paste it below in
//      place of "null".
//   4. In the left sidebar, go to Build > Realtime Database > Create
//      Database. Pick any region and start in "test mode".
//   5. Still in Realtime Database, open the "Rules" tab, paste in the rules
//      from README.md's "Live Sync" section, and click Publish. Test-mode
//      rules expire after 30 days and lock everyone out, so this step
//      matters.
//   6. Reload the app. A "Live Sync" box appears on the Ages tab.
//
window.FCNY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyADwZYsUwMBCXSfvWnbNrnrdS0ugEvy3kI",
  authDomain: "fcny-tourney.firebaseapp.com",
  databaseURL: "https://fcny-tourney-default-rtdb.firebaseio.com",
  projectId: "fcny-tourney",
  storageBucket: "fcny-tourney.firebasestorage.app",
  messagingSenderId: "222690053523",
  appId: "1:222690053523:web:003319f445164186952c66"
};
