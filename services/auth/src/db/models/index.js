'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../../../config/config.js')[env];
const db = {};
require('dotenv').config();

// let sequelize;
// if (config.use_env_variable) {
//   sequelize = new Sequelize(process.env[config.use_env_variable], config);
// } else {
//   sequelize = new Sequelize(config.database, config.username, config.password, config);
// }

var sequelize = new Sequelize(process.env.DATABASE, process.env.DBUSERNAME, process.env.PASSWORD, {
  host: process.env.DBHOST,
  dialect: process.env.DIALECT,
  logging: (msg) => {
    console.log(msg,"sequelize-logging");
  },
  schema : process.env.SCHEMA
});

sequelize.authenticate().then(() => {
  console.log('Connection has been estabilished successfully');
}).catch((error) => {
  console.log('Unable to connect to the database:', error);
})

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.ts' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
