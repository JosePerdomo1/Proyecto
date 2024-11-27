const express = require('express');
const app = express();
const { Pool } = require('pg'); 
const port = process.env.PORT || 10000;
const pool = new Pool({
  connectionString: 'postgresql://jose:27dgCgtjtqrvybOGIZrbxaYov8iHiWYi@dpg-ct3nqq5umphs73e04900-a/sensor_db_oie7',
  ssl: {
    rejectUnauthorized: false 
  }
});

let latestTemperature = null;
let latestCity = null;
let latestLatitude = null;
let latestLongitude = null;

app.route('/temperature')
  .get((req, res) => {
    // Devolver la última temperatura y ubicación
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
  })
  .post(async (req, res) => {
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
        const sensorName = 'Arduino UNO R4 WIFI';
        const sensorResult = await pool.query(
          'SELECT id FROM sensores WHERE nombre = $1',
          [sensorName]
        );

        if (sensorResult.rows.length === 0) {
          throw new Error(`No se encontró un sensor con el nombre: ${sensorName}`);
        }

        const sensorId = sensorResult.rows[0].id;

        const ubicacionResult = await pool.query(
          `INSERT INTO ubicaciones (nombre, latitud, longitud, descripcion)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (nombre) DO UPDATE SET latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud
           RETURNING id`,
          [city, latitude, longitude, `Ubicación de ${city}`]
        );
        const ubicacionId = ubicacionResult.rows[0].id;

        await pool.query(
          `INSERT INTO temperatura_historial (fecha, temperatura, sensor_id, ubicacion_id, comentarios)
           VALUES ($1, $2, $3, $4, $5)`,
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

// // Endpoint para obtener la última temperatura y ubicación
// app.get('/getTemperature', (req, res) => {
//   if (latestTemperature !== null && latestCity && latestLatitude !== null && latestLongitude !== null) {
//     res.json({
//       temperature: latestTemperature,
//       city: latestCity,
//       latitude: latestLatitude,
//       longitude: latestLongitude
//     });
//   } else {
//     res.status(404).json({ error: 'No hay datos disponibles' });
//   }
// });

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
