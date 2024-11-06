const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

let latestTemperature = null; // Variable para almacenar la última temperatura recibida

// Endpoint para recibir datos de temperatura
app.get('/temperature', (req, res) => {
  const temperature = parseFloat(req.query.temp); // Leer el parámetro "temp" de la URL
  if (!isNaN(temperature)) {
    latestTemperature = temperature; 
    console.log(`Temperatura recibida: ${temperature}°C`);
    res.send('Temperatura recibida');
  } else {
    res.status(400).send('Temperatura inválida');
  }
});

// Endpoint para servir la página web
app.get('/', (req, res) => {
  const path = require('path');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
  
});

// Endpoint para obtener la última temperatura
app.get('/getTemperature', (req, res) => {
  if (latestTemperature !== null) {
    res.json({ temperature: latestTemperature }); // Envía la temperatura como JSON
  } else {
    res.status(404).json({ error: 'No hay datos de temperatura disponibles' });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
