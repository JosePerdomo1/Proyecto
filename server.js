const express = require('express');
const app = express();
const { Pool } = require('pg'); 
const port = process.env.PORT || 10000;
const pool = new Pool({
  connectionString: 'postgresql://jose:vqb9a9QXcznKtkdOrvcWIn5ROBak3NIk@dpg-cssi571u0jms73ebfuo0-a.frankfurt-postgres.render.com/sensor_db',
  ssl: {
    rejectUnauthorized: false // Esto permite conexiones SSL seguras
  }
});

let latestTemperature = null;
let latestCity = null;
let latestLatitude = null;
let latestLongitude = null;

app.get('/temperature', async (req, res) => {
  const temperature = parseFloat(req.query.temp);
  const city = req.query.city;
  const latitude = parseFloat(req.query.lat);
  const longitude = parseFloat(req.query.lon);

  // Validar los datos
  if (!isNaN(temperature) && city && !isNaN(latitude) && !isNaN(longitude)) {
    latestTemperature = temperature;
    latestCity = city;
    latestLatitude = latitude;
    latestLongitude = longitude;

    console.log(`Datos recibidos: 
      Temperatura: ${temperature}°C,
      Ciudad: ${city},
      Latitud: ${latitude},
      Longitud: ${longitude}`);

    // Guardar los datos en la base de datos
   
    try {
      // Inserta o actualiza la ubicación en la tabla "ubicaciones"
      const ubicacionResult = await pool.query(
        'INSERT INTO ubicaciones (nombre, latitud, longitud, descripcion) VALUES ($1, $2, $3, $4) RETURNING id',
        [city, latitude, longitude, `Ubicación de ${city}`]
      );
      ubicacionId = ubicacionResult.rows[0].id;

      // Inserta los datos de temperatura en la tabla "temperatura_historial"
      await pool.query(
        'INSERT INTO temperatura_historial (fecha, temperatura, sensor_id, ubicacion_id, comentarios) VALUES ($1, $2, $3, $4, $5)',
        [new Date(), temperature, sensorId, ubicacionId, 'Lectura de temperatura registrada']
      );
      res.send('Datos recibidos y guardados en la base de datos');
    } catch (error) {
      console.error('Error al guardar los datos en la base de datos:', error);
      res.status(500).send('Error al guardar los datos en la base de datos');
    }
  } else {
    res.status(400).send('Datos inválidos');
  }
});

// Endpoint para servir la página web
app.get('/', (req, res) => {
  const path = require('path');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
  
});

// Endpoint para obtener la última temperatura y ubicación
app.get('/getTemperature', (req, res) => {
  if (latestTemperature !== null && latestCity && latestLatitude !== null && latestLongitude !== null) {
    res.json({
      temperature: latestTemperature,
      city: latestCity,
      latitude: latestLatitude,
      longitude: latestLongitude
    });
  } else {
    res.status(404).json({ error: 'No hay datos disponibles' });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
