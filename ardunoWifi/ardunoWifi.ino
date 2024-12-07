#include <OneWire.h>
#include <DallasTemperature.h>
#include "R4WiFi_secrets.h"
#include <R4HttpClient.h>
#include <WiFi.h>
#include <ArduinoJson.h>

#define ONE_WIRE_BUS 7
#define LED_RED 13
#define LED_GREEN 12

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
WiFiSSLClient client;
R4HttpClient http;

const char* _SSID = SECRET_SSID;
const char* _PASS = SECRET_PASS;
const char* serverIP = "proyecto-pt9k.onrender.com";
const int serverPort = 443;
const char* googleApiKey = SECRET_PASS_GOOGLE;

String city = "Valencia";
float latitude = 0;
float longitude = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial)
    ;


  sensors.begin();

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);

  conectarWiFi();
  obtenerUbicacionGoogle();  
}

void loop() {
  // Verificar si se perdió la conexión WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Conexión WiFi perdida. Intentando reconectar...");
    conectarWiFi();
  }
  
  // Obtener y enviar la temperatura junto con la ubicación
  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);

  if (temperature != DEVICE_DISCONNECTED_C) {
    Serial.print("Temperatura: ");
    Serial.print(temperature);
    Serial.println(" °C");
    enviarDatosAlServidor(temperature, city.c_str(), latitude, longitude);  
  } else {
    Serial.println("Error: Sensor no conectado o lectura inválida.");
  }

  delay(10000);
}

void conectarWiFi() {
  digitalWrite(LED_RED, HIGH);
  digitalWrite(LED_GREEN, LOW);

  Serial.println("Conectando a WiFi...");
  WiFi.begin(_SSID, _PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }

  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, HIGH);

  Serial.println("\nConexión WiFi exitosa.");
  Serial.print("Dirección IP: ");
  Serial.println(WiFi.localIP());
}

void obtenerUbicacionGoogle() {
  const char* host = "www.googleapis.com";
  const int httpsPort = 443;

  String endpoint = String("/geolocation/v1/geolocate?key=") + googleApiKey;

  String payload = "{\"considerIp\": true}";  

  Serial.println("Conectando al servidor de Google...");

  if (!client.connect(host, httpsPort)) {
    Serial.println("Error al conectar con Google.");
    return;
  }

  client.println("POST " + endpoint + " HTTP/1.1");
  client.println("Host: " + String(host));
  client.println("Content-Type: application/json");
  client.println("Connection: close");
  client.print("Content-Length: ");
  client.println(payload.length());
  client.println();         
  client.println(payload);  

  Serial.println("Solicitud enviada. Leyendo respuesta...");

  String response = "";
  while (client.connected()) {
    if (client.available()) {
      response += client.readString();
    }
  }

  client.stop();

  Serial.println("Respuesta completa:");
  Serial.println(response.substring(0, 100)); 

  int statusStart = response.indexOf("HTTP");
  if (statusStart >= 0) {
    String statusLine = response.substring(statusStart, response.indexOf("\n", statusStart));
    Serial.println("Estado de la respuesta: " + statusLine);
  }

  int jsonStart = response.indexOf('{');
  if (jsonStart >= 0) {
    String jsonResponse = response.substring(jsonStart);
    Serial.println("Cuerpo JSON recibido: ");
    Serial.println(jsonResponse); 

 
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, jsonResponse);

    if (!error) {
      latitude = doc["location"]["lat"];  
      longitude = doc["location"]["lng"]; 

      Serial.print("Latitud: ");
      Serial.println(latitude);
      Serial.print("Longitud: ");
      Serial.println(longitude);
    } else {
      Serial.println("Error al analizar JSON.");
    }
  } else {
    Serial.println("No se encontró JSON en la respuesta.");
  }
}

void enviarDatosAlServidor(float temp, const char* city, float lat, float lon) {
  String url = String("/temperature?temp=") + String(temp) + "&city=" + String(city) + "&lat=" + String(lat) + "&lon=" + String(lon);
  http.begin(client, String("https://") + serverIP + url, serverPort);
  int responseNum = http.POST("");

  if (responseNum > 0) {
    String responseBody = http.getBody();
    Serial.println("Respuesta del servidor: " + responseBody);
    Serial.println("Código de respuesta: " + String(responseNum));
  } else {
    Serial.println("Error en la solicitud: " + String(responseNum));
  }

  http.close();
}
