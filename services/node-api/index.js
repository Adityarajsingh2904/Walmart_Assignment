const express = require('express');
const app = express();
const port = process.env.PORT || 4000;

app.get('/health', (req, res) => res.send('ok'));

app.listen(port, () => {
  console.log(`Node API listening on port ${port}`);
});

