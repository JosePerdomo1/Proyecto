const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// puerto utilizado COM5
const port = new SerialPort({ path: 'COM5', baudRate: 9600 });

// el parser para leer datos línea por línea
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

// Evento que ocurre cuando recibes datos del puerto serial
parser.on('data', (data) => {
  console.log('Temperatura: ' + data);
});


port.on('error', (err) => {
  console.log('Error: ', err.message);
});
