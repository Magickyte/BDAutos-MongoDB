# Proyecto 2 - Bases de Datos Avanzadas
## Migración Relacional a NoSQL y Consultas con MongoDB 

### Integrantes:
- **377043** – Angel Rodriguez Palomino
- **377304** – Zahid Alberto Jimenes Pérez
- **377061** – Jared Isai López Espino

---

## Descripción del Proyecto
Sistema para la consulta, análisis y visualización de un catálogo automotriz migrado desde un esquema relacional (SQL de 6 tablas: `Continents`, `Countries`, `Car_Makers`, `Model_List`, `Car_Names` y `Car_Details`) hacia una base de datos orientada a documentos en **MongoDB**, respaldado por el **Aggregation Framework** para resolver 25 consultas analíticas.

---

## Diseño de la Base de Datos (¿Por qué se hizo así?)

Para la migración se utilizó un **diseño híbrido (Embebido + Referenciado)** pasando de 6 tablas relacionales a solo **3 colecciones principales** (`makers`, `models` y `cars`), lo que reduce la necesidad de hacer uniones (`$lookup`) y agiliza las consultas:

<img width="390" height="608" alt="Modelo de Base de Datos en MongoDB" src="https://iili.io/nPejQqB.png" />

### 1. `Continents` y `Countries` dentro de `makers` *(Embebido)*
Como `Continents` y `Countries` solo guardaban un nombre descriptivo estático, se incluyeron directamente como campos (`country` y `continent`) en cada fabricante. Esto evita hacer múltiples `$lookup` en reportes agrupados por país o continente.

```json
{ "_id": 1, "maker": "gm", "fullName": "General Motors", "country": "usa", "continent": "america" }
```

### 2. Especificaciones dentro de `cars` *(Embebido)*
Dado que `Car_Names` y `Car_Details` tienen una relación estricta de **1 a 1**, se unieron en la colección `cars` guardando la ficha técnica (`mpg`, `cylinders`, `edispl`, `horsepower`, `weight`, `accel`, `year`) en el subdocumento `details`. Esto permite obtener la descripción y el rendimiento del auto en una sola lectura.

```json
{
  "_id": 6,
  "model_id": 1,
  "descr": "chevrolet corvette stingray 6.2",
  "details": { "mpg": 19, "cylinders": 8, "edispl": 376, "horsepower": 495, "weight": 3650, "accel": 2.9, "year": 2025 }
}
```

### 3. Marcas en `models` *(Referenciado / Linking)*
Se conservó la colección de marcas/líneas vinculada mediante `maker_id` (y referenciada desde `cars` vía `model_id`) para mantener el catálogo organizado y resolver consultas sobre fabricantes sin autos o con múltiples líneas sin duplicar datos.

---

## Motor de Consultas con Aggregation Framework (`Consultas.py` / `Consultas.js`):

Toda la lógica pesada se ejecuta directamente en el motor de MongoDB mediante pipelines de agregación que utilizan:
  - *Uniones dirigidas:* `$lookup` y `$unwind` solo cuando se requiere cruzar autos con fabricantes.
  - *Funciones de ventana:* `$setWindowFields` y `$documentNumber` para calcular rankings de potencia por país y comparar el rendimiento de cada auto contra el promedio de su número de cilindros.
  - *Clasificación y segmentación:* `$bucket` y `$switch` para agrupar vehículos por rangos de rendimiento (`mpg`) o categorías (*Alta*, *Media*, *Baja*).
  - *Consultas multifaceta:* `$facet` para ejecutar múltiples reportes estadísticos simultáneos en una sola lectura.

---

## Interfaz de Usuario
La interfaz está construida con **CustomTkinter**, proporcionando una experiencia visual fluida y adaptativa que cambia automáticamente según el tipo de resultado que devuelve MongoDB.

<img width="800" alt="Inspector de código Mongo y Zoom" src="https://iili.io/nPejZ0P.png" />


### 1. Selector de Consultas y Ejecución en Tiempo Real
- **Filtrado y Selección (`CTkComboBox`):** Menú desplegable con las 25 consultas analíticas listas para ejecutarse contra `mongodb://localhost:27017/` y contador dinámico de registros encontrados.

<!-- Pega aquí tu captura de pantalla del selector / ventana principal -->
<!-- <img width="800" alt="Selector de consultas" src="URL_DE_TU_IMAGEN_AQUI" /> -->

### 2. Visualización de Resultados (Tabla Dinámica vs. JSON)
- **Vista Tabular Dinámica (`Treeview`):** Para consultas con resultados planos (rankings, promedios por país, conteos), el programa detecta automáticamente los campos devueltos por el pipeline y construye las columnas y encabezados en tiempo real.

<!-- Pega aquí tu captura de pantalla mostrando una tabla de resultados -->
<!-- <img width="800" alt="Vista de tabla dinámica" src="URL_DE_TU_IMAGEN_AQUI" /> -->

- **Detección de Estructuras Complejas (Visor JSON):** Cuando una consulta devuelve arreglos u objetos anidados que no pueden tabularse sin perder jerarquía (como listas de modelos por fabricante, `$slice` de top 3 autos por continente o resultados de `$facet`), la interfaz oculta la tabla y conmuta automáticamente al visor JSON formateado.

<!-- Pega aquí tu captura de pantalla mostrando un resultado JSON anidado (ej. Consulta 5, 16 o 23) -->
<!-- <img width="800" alt="Vista de JSON anidado" src="URL_DE_TU_IMAGEN_AQUI" /> -->

### 3. Inspector de Código Mongo y Controles de Zoom
- **Botón `Ver Código Mongo`:** Muestra en pantalla el pipeline exacto (`db.coleccion.aggregate([...])`) que se envía al servidor para la consulta seleccionada.
- **Control de Accesibilidad (`A+` / `A-`):** Barra de herramientas superior que se activa en las vistas de texto/código para aumentar o disminuir dinámicamente el tamaño de la fuente (`Consolas`).

---
