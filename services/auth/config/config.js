require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DBUSERNAME || 'root',
    password: process.env.PASSWORD || '',
    database: process.env.DATABASE || 'my_database',
    host: process.env.DBHOST || 'localhost',
    dialect: 'postgres',
    schema : process.env.SCHEMA
  },
  test: {
    username: process.env.DBUSERNAME || 'root',
    password: process.env.PASSWORD || '',
    database: process.env.DATABASE || 'my_database_test',
    host: process.env.DBHOST || 'localhost',
    dialect: 'postgres',
    schema : process.env.SCHEMA
  },
  production: {
    username: process.env.DBUSERNAME || 'root',
    password: process.env.PASSWORD || '',
    database: process.env.DATABASE || 'my_database_production',
    host: process.env.DBHOST || 'localhost',
    dialect: 'postgres',
    schema : process.env.SCHEMA
  }
};
