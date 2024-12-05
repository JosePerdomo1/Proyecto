const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const app = express();
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const port = process.env.PORT || 10000;
const pool = new Pool({
  connectionString: 'postgresql://jose:27dgCgtjtqrvybOGIZrbxaYov8iHiWYi@dpg-ct3nqq5umphs73e04900-a/sensor_db_oie7',
  ssl: {
    rejectUnauthorized: false
  }
});
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 

let latestTemperature = null;
let latestCity = null;
let latestLatitude = null;
let latestLongitude = null;

app.use(session({
  secret: process.env.PASSADMIN,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(400).send('Usuario no encontrado');
    }

    const user = result.rows[0];

    // Verificar la contraseña usando bcrypt
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).send('Contraseña incorrecta');
    }
    console.log('Username ingresado:', username);
    console.log('Contraseña ingresada:', password);
    console.log('Resultado de la consulta:', result.rows);

    // Establecer la sesión
    req.session.userId = user.id;
    req.session.username = user.username;

    res.send('Inicio de sesión exitoso');
  } catch (error) {
    console.error('Error de inicio de sesión:', error);
    res.status(500).send('Error al procesar la solicitud');
  }
});
function isAuthenticated(req, res, next) {
  if (!req.session.userId) {
    return res.status(403).send('Acceso denegado. Debes iniciar sesión');
  }
  next();
}
app.post('/api/validate-admin-password', (req, res) => {
  const { password } = req.body;

  if (password === process.env.PASSADMIN) {
    res.status(200).send('Validado');
  } else {
    res.status(401).send('Contraseña incorrecta');
  }
});


app.get('/admin', isAuthenticated, (req, res) => {
  res.send('Bienvenido a la página de administración');
});
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Error al cerrar sesión');
    }
    res.send('Sesión cerrada con éxito');
  });
});
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Verificar si el usuario ya existe
    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);

    if (result.rows.length > 0) {
      return res.status(400).send('El usuario ya existe');
    }

    // Encriptar la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar el nuevo usuario en la base de datos
    const newUser = await pool.query('INSERT INTO usuarios (username, password) VALUES ($1, $2) RETURNING *', [username, hashedPassword]);

    res.status(201).send('Usuario registrado con éxito');
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).send('Error al registrar el usuario');
  }
});


app.post('/temperature', async (req, res) => {
  const temperature = parseFloat(req.query.temp);
  const city = req.query.city;
  const latitude = parseFloat(req.query.lat);
  const longitude = parseFloat(req.query.lon);

  if (!isNaN(temperature) && city && !isNaN(latitude) && !isNaN(longitude)) {
    latestTemperature = temperature;
    latestCity = city;
    latestLatitude = latitude;
    latestLongitude = longitude;
    console.log(`Datos recibidos:
        Temperatura: ${temperature}°C
        Ciudad: ${city}
        Latitud: ${latitude}
        Longitud: ${longitude}`);
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
         RETURNING id;`,
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

app.get('/getTemperature', (_, res) => {
  const temperature = latestTemperature;
  const city = latestCity;
  const latitude = latestLatitude;
  const longitude = latestLongitude;
  const responseUrl = `temp=${temperature}&city=${city}&lat=${latitude}&lon=${longitude}`;
  res.send(responseUrl);
});

app.post('/send', async (req, res) => {
  console.log(req.body);

  const { name, email, subject, message, terms } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).send('Faltan campos requeridos');
  }

  try {
    await pool.query(
      `INSERT INTO formulario_contacto (nombre, correo, asunto, mensaje, terminos)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, email, subject, message, terms ? 'Aceptados' : 'No aceptados']
    );

    const transporter = nodemailer.createTransport({
      service: 'outlook',
      auth: {
        user: process.env.USERMAIL,
        pass: process.env.PASSMAIL,
      },
    });

    const mailOptions = {
      from: process.env.USERMAIL,
      to: email,
      subject: `Gracias por tu mensaje: ${subject}`,
      text: `Hola ${name},\n\nHemos recibido tu mensaje:\n\n"${message}"\n\nNos pondremos en contacto contigo pronto.\n\nSaludos,\nEl equipo.`,
    };

    await transporter.sendMail(mailOptions);

    console.log('Datos guardados y correo enviado con éxito.');
    res.status(200).send('Formulario enviado con éxito.');
  } catch (error) {
    console.error('Error al procesar el formulario:', error);
    res.status(500).send('Hubo un error al procesar el formulario.');
  }
});
app.get('/api/sensores', async (_, res) => {
  try {
    const result = await pool.query('SELECT * FROM sensores');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sensors:', error);
    res.status(500).send('Error al obtener los sensores');
  }
});
app.get('/api/temperaturaHistorial', async (_, res) => {
  try {
    const result = await pool.query('SELECT * FROM temperatura_historial');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching temperature history:', error);
    res.status(500).send('Error al obtener el historial de temperaturas');
  }
});
app.get('/api/formulario_contacto', async (_, res) => {
  try {
      const result = await pool.query('SELECT * FROM formulario_contacto');
      res.json(result.rows);
  } catch (error) {
      console.error('Error al obtener los mensajes del formulario de contacto:', error);
      res.status(500).send('Error al obtener los mensajes');
  }
});

app.get('/', (_, res) => {
  const path = require('path');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));

});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
