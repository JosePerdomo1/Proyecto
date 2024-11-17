#include <OneWire.h>
#include <DallasTemperature.h>
#include "R4WiFi_secrets.h"  // Asegúrate de tener un archivo con las credenciales de WiFi
#include <R4HttpClient.h>
#include <WiFi.h>

#define TEMP_SENSOR 0
#define LED_RED 12
#define LED_GREEN 13

WiFiSSLClient client;  // Cliente seguro para HTTPS
R4HttpClient http;     // Cliente HTTP compatible con Arduino UNO R4 WiFi

const char* _SSID = SECRET_SSID;
const char* _PASS = SECRET_PASS;
const char* serverIP = "proyecto-pt9k.onrender.com";
const int serverPort = 443;

void setup() {
  Serial.begin(115200);
  while (!Serial);

  String fv = WiFi.firmwareVersion();
  if (fv < WIFI_FIRMWARE_LATEST_VERSION) {
    Serial.println(F("Please upgrade the firmware"));
  }

  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println(F("Communication with WiFi module failed!"));
    while (true);
  }

  Serial.println("Conectando a WiFi...");
  WiFi.begin(_SSID, _PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\nConectado a WiFi");
  Serial.print("Dirección IP: ");
  Serial.println(WiFi.localIP());
}

float signalVoltage, temperature;

void loop() {
  // Lee la señal analógica (0 a 1023)
  signalVoltage = analogRead(TEMP_SENSOR);
  // Convierte la señal a temperatura en grados Celsius
  temperature = (5 * signalVoltage * 100) / 1024;

  if (temperature != DEVICE_DISCONNECTED_C) {
    Serial.print("Temperatura: ");
    Serial.print(temperature);
    Serial.println(" °C");
    enviarTemperaturaAlServidor(temperature);
  } else {
    Serial.println("Error: Sensor no conectado o lectura inválida.");
  }

  delay(10000);  // Espera 10 segundos antes de la próxima lectura
}

void enviarTemperaturaAlServidor(float temp) {
  http.begin(client, "https://" + String(serverIP) + "/temperature?temp=" + String(temp), serverPort);
  http.setTimeout(3000);
  http.addHeader("User-Agent: Arduino UNO R4 WiFi");
  http.addHeader("Connection: close");

  int responseNum = http.GET();
  if (responseNum > 0) {  // Si la solicitud fue exitosa
    String responseBody = http.getBody();
    Serial.println("Respuesta del servidor: " + responseBody);
    Serial.println("Código de respuesta: " + String(responseNum));
  } else {
    Serial.println("Error en la solicitud: " + String(responseNum));
  }

  http.close();  // Cierra la conexión HTTP
}
