// 1. Autos con año >= 2024 y mpg >= 35
db.cars.aggregate([
  { $match: { "details.year": { $gte: 2024 }, "details.mpg": { $gte: 35 } } },
  { $project: { _id: 0, descripcion: "$descr", año: "$details.year", rendimiento: "$details.mpg" } },
  { $sort: { rendimiento: -1 } }
]);

// 2. Autos europeos de 4 cilindros y >= 250 hp
db.cars.aggregate([
  { $match: { "details.cylinders": 4, "details.horsepower": { $gte: 250 } } },
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $match: { "maker_info.continent": "europe" } },
  { $project: { _id: 0, descripcion: "$descr", pais: "$maker_info.country", potencia: "$details.horsepower" } },
  { $sort: { potencia: -1 } }
]);

// 3. Autos de fabricantes japoneses con motor turbo
db.cars.aggregate([
  { $match: { descr: /t$/i } },
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $match: { "maker_info.country": "japan" } },
  { $count: "total_autos_japoneses_turbo" }
]);

// 4. Autos con (peso < 3000 y acel < 9) O (cilindros >= 8 y mpg >= 19)
db.cars.aggregate([
  { $match: { 
      $or: [
        { "details.weight": { $lt: 3000 }, "details.accel": { $lt: 9 } },
        { "details.cylinders": { $gte: 8 }, "details.mpg": { $gte: 19 } }
      ]
  } },
  { $project: { _id: 0, descr: 1, "details.weight": 1, "details.accel": 1, "details.cylinders": 1, "details.mpg": 1 } }
]);

// 5. Fabricantes que comercializan más de una marca o línea
db.makers.aggregate([
  { $lookup: { from: "models", localField: "_id", foreignField: "maker_id", as: "models_list" } },
  { $match: { $expr: { $gt: [{ $size: "$models_list" }, 1] } } },
  { $project: { _id: 0, nombre: "$maker", pais: "$country", modelos: "$models_list.model" } }
]);

// 6. Autos cuya marca es distinta del nombre de su grupo fabricante
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $match: { $expr: { $ne: ["$model_info.model", "$maker_info.maker"] } } },
  { $project: { _id: 0, descripcion: "$descr", marca: "$model_info.model", fabricante: "$maker_info.maker" } }
]);

// 7. Por país: número de autos, rendimiento y potencia promedio
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $group: { _id: "$maker_info.country", num_autos: { $sum: 1 }, avg_mpg: { $avg: "$details.mpg" }, avg_hp: { $avg: "$details.horsepower" } } },
  { $project: { _id: 0, pais: "$_id", num_autos: 1, rendimiento_promedio: { $round: ["$avg_mpg", 1] }, potencia_promedio: { $round: ["$avg_hp", 1] } } },
  { $sort: { num_autos: -1 } }
]);

// 8. Por grupo fabricante: autos, marcas distintas y potencia promedio
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $group: { _id: "$model_info.maker_id", num_autos: { $sum: 1 }, marcas_distintas: { $addToSet: "$model_info._id" }, avg_hp: { $avg: "$details.horsepower" } } },
  { $lookup: { from: "makers", localField: "_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $project: { _id: 0, fabricante: "$maker_info.maker", num_autos: 1, num_marcas_distintas: { $size: "$marcas_distintas" }, potencia_promedio: { $round: ["$avg_hp", 1] } } },
  { $sort: { num_autos: -1 } }
]);

// 9. Modelos (marcas) por continente
db.models.aggregate([
  { $lookup: { from: "makers", localField: "maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $group: { _id: "$maker_info.continent", total_modelos: { $sum: 1 } } },
  { $project: { _id: 0, continente: "$_id", total_modelos: 1 } }
]);

// 10. Clasificación de autos en rangos de rendimiento
db.cars.aggregate([
  { $bucket: {
      groupBy: "$details.mpg",
      boundaries: [0, 20, 25, 30, 35, 40],
      default: "40 o más",
      output: { cantidad_autos: { $sum: 1 }, peso_promedio: { $avg: "$details.weight" } }
  } }
]);

// 11. 5 fabricantes con mayor rendimiento promedio (min 8 autos)
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $group: { _id: "$model_info.maker_id", avg_mpg: { $avg: "$details.mpg" }, total_autos: { $sum: 1 } } },
  { $match: { total_autos: { $gte: 8 } } },
  { $lookup: { from: "makers", localField: "_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $project: { _id: 0, fabricante: "$maker_info.maker", rendimiento_promedio: { $round: ["$avg_mpg", 2] }, total_autos: 1 } },
  { $sort: { rendimiento_promedio: -1 } },
  { $limit: 5 }
]);

// 12. Clasificación Alta/Media/Baja por continente
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $addFields: { 
      categoria: { 
        $switch: { 
          branches: [ 
            { case: { $gte: ["$details.mpg", 30] }, then: "Alta" }, 
            { case: { $gte: ["$details.mpg", 20] }, then: "Media" } 
          ], 
          default: "Baja" 
        } 
      } 
  } },
  { $group: { _id: { continente: "$maker_info.continent", categoria: "$categoria" }, total_autos: { $sum: 1 } } },
  { $project: { _id: 0, continente: "$_id.continente", categoria: "$_id.categoria", total_autos: 1 } }
]);

// 13. Total de autos por fabricante (incluyendo ceros)
db.makers.aggregate([
  { $lookup: { from: "models", localField: "_id", foreignField: "maker_id", as: "models_list" } },
  { $lookup: { from: "cars", localField: "models_list._id", foreignField: "model_id", as: "cars_list" } },
  { $project: { _id: 0, fabricante: "$maker", total_autos: { $size: "$cars_list" } } }
]);

// 14. Modelos sin ningún auto registrado
db.models.aggregate([
  { $lookup: { from: "cars", localField: "_id", foreignField: "model_id", as: "cars_list" } },
  { $match: { cars_list: { $size: 0 } } },
  { $project: { _id: 0, modelo_sin_autos: "$model" } }
]);

// 15. 5 autos más potentes (descripción, potencia, fullName fabricante)
db.cars.aggregate([
  { $sort: { "details.horsepower": -1 } },
  { $limit: 5 },
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $project: { _id: 0, descripcion: "$descr", potencia: "$details.horsepower", fabricante_fullName: "$maker_info.fullName" } }
]);

// 16. Para cada continente, los 3 autos con mayor rendimiento
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $sort: { "details.mpg": -1 } },
  { $group: { _id: "$maker_info.continent", top_cars: { $push: { descripcion: "$descr", mpg: "$details.mpg" } } } },
  { $project: { _id: 0, continente: "$_id", top_3_autos: { $slice: ["$top_cars", 3] } } }
]);

// 17. Modelo con más autos registrados por fabricante (solo fabricantes con >1 modelo)
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $group: { _id: { maker_id: "$model_info.maker_id", model_name: "$model_info.model" }, count_autos: { $sum: 1 } } },
  { $sort: { "_id.maker_id": 1, count_autos: -1 } },
  { $group: { _id: "$_id.maker_id", total_modelos: { $sum: 1 }, modelos: { $push: { model_name: "$_id.model_name", count_autos: "$count_autos" } } } },
  { $match: { total_modelos: { $gt: 1 } } },
  { $project: { _id: 0, maker_id: "$_id", modelo_con_mas_autos: { $arrayElemAt: ["$modelos", 0] } } },
  { $lookup: { from: "makers", localField: "maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $project: { fabricante: "$maker_info.maker", modelo_con_mas_autos: 1 } }
]);

// 18. Porcentaje de autos por continente
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $group: { _id: "$maker_info.continent", autos_continente: { $sum: 1 } } },
  { $group: { _id: null, total_general: { $sum: "$autos_continente" }, datos: { $push: { continente: "$_id", autos: "$autos_continente" } } } },
  { $unwind: "$datos" },
  { $project: { _id: 0, continente: "$datos.continente", porcentaje: { $round: [ { $multiply: [{ $divide: ["$datos.autos", "$total_general"] }, 100] }, 2 ] } } }
]);

// 19. 5 autos que más superan el rendimiento promedio de su número de cilindros
db.cars.aggregate([
  { $setWindowFields: { partitionBy: "$details.cylinders", output: { avg_mpg: { $avg: "$details.mpg" } } } },
  { $project: { _id: 0, descripcion: "$descr", cilindros: "$details.cylinders", mpg_auto: "$details.mpg", promedio_cilindros: { $round: ["$avg_mpg", 2] }, diferencia: { $round: [ { $subtract: ["$details.mpg", "$avg_mpg"] }, 2 ] } } },
  { $sort: { diferencia: -1 } },
  { $limit: 5 }
]);

// 20. Por continente: total autos, con V8 o más, y su porcentaje
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $group: { _id: "$maker_info.continent", total_autos: { $sum: 1 }, autos_v8_plus: { $sum: { $cond: [{ $gte: ["$details.cylinders", 8] }, 1, 0] } } } },
  { $project: { _id: 0, continente: "$_id", total_autos: 1, autos_8_o_mas_cilindros: "$autos_v8_plus", porcentaje: { $round: [ { $multiply: [ { $divide: ["$autos_v8_plus", "$total_autos"] }, 100 ] }, 1 ] } } }
]);

// 21. 10 autos con mayor potencia por cada 1000 lb de peso
db.cars.aggregate([
  { $project: { descr: 1, model_id: 1, potencia_por_1000lb: { $multiply: [ { $divide: ["$details.horsepower", "$details.weight"] }, 1000 ] } } },
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $project: { _id: 0, descripcion: "$descr", pais: "$maker_info.country", ratio_potencia_peso: { $round: ["$potencia_por_1000lb", 2] } } },
  { $sort: { ratio_potencia_peso: -1 } },
  { $limit: 10 }
]);

// 22. Modelos cuyo nombre es distinto al nombre del fabricante
db.makers.aggregate([
  { $lookup: { from: "models", localField: "_id", foreignField: "maker_id", as: "models_list" } },
  { $project: { fabricante: "$maker", modelos_filtrados: { $filter: { input: "$models_list", as: "m", cond: { $ne: ["$$m.model", "$maker"] } } } } },
  { $match: { "modelos_filtrados.0": { $exists: true } } },
  { $project: { _id: 0, fabricante: 1, modelos_distintos: "$modelos_filtrados.model" } }
]);

// 23. Consulta Global (Continente, Cilindros, MPG)
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $facet: { 
      por_continente: [ { $group: { _id: "$maker_info.continent", total: { $sum: 1 } } } ],
      por_cilindros: [ { $group: { _id: "$details.cylinders", total: { $sum: 1 } } } ],
      estadisticas_mpg: [ { $group: { _id: null, min_mpg: { $min: "$details.mpg" }, max_mpg: { $max: "$details.mpg" }, avg_mpg: { $avg: "$details.mpg" } } } ]
  } }
]);

// 24. Top 5 alemanes posicionados por potencia
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $match: { "maker_info.country": "germany" } },
  { $setWindowFields: { partitionBy: "$maker_info.country", sortBy: { "details.horsepower": -1 }, output: { ranking: { $documentNumber: {} } } } },
  { $project: { _id: 0, descripcion: "$descr", potencia: "$details.horsepower", pais: "$maker_info.country", ranking: 1 } },
  { $sort: { ranking: 1 } },
  { $limit: 5 }
]);

// 25. Auto más eficiente de cada fabricante europeo
db.cars.aggregate([
  { $lookup: { from: "models", localField: "model_id", foreignField: "_id", as: "model_info" } },
  { $unwind: "$model_info" },
  { $lookup: { from: "makers", localField: "model_info.maker_id", foreignField: "_id", as: "maker_info" } },
  { $unwind: "$maker_info" },
  { $match: { "maker_info.continent": "europe" } },
  { $sort: { "details.mpg": -1 } },
  { $group: { _id: "$maker_info._id", fabricante: { $first: "$maker_info.maker" }, auto_mas_eficiente: { $first: "$descr" }, mayor_mpg: { $first: "$details.mpg" } } },
  { $project: { _id: 0, fabricante: 1, auto_mas_eficiente: 1, mayor_mpg: 1 } }
]);