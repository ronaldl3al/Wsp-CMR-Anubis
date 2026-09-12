require("../bootstrap");

let config: any = {
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_bin"
  },
  dialect: process.env.DB_DIALECT || "mysql",
  timezone: "-03:00",
  logging: false
};

if (process.env.MYSQLHOST) {
  // Support Railway individual variables natively
  config.host = process.env.MYSQLHOST;
  config.port = process.env.MYSQLPORT || 3306;
  config.database = process.env.MYSQLDATABASE;
  config.username = process.env.MYSQLUSER;
  config.password = process.env.MYSQLPASSWORD;
} else {
  // Default legacy config
  config.host = process.env.DB_HOST;
  config.database = process.env.DB_NAME;
  config.username = process.env.DB_USER;
  config.password = process.env.DB_PASS;
}

module.exports = {
  development: config,
  test: config,
  production: config
};
