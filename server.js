const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Endpoint para recibir datos de temperatura
app.get('/temperature', (req, res) => {
  const temperature = parseFloat(req.query.temp);  // Leer el parámetro "temp" de la URL
  if (!isNaN(temperature)) {
    console.log(`Temperatura recibida: ${temperature}°C`);
    // Aquí podrías guardar los datos en la base de datos, si lo deseas.
    res.send('Temperatura recibida');
  } else {
    res.status(400).send('Temperatura inválida');
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
