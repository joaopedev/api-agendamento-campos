import Knex from "knex";
require("dotenv").config();

export const knex = Knex({
  client: "pg",
  connection: {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false },
  },
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    afterCreate: (conn: any, done: Function) => {
      conn.query('SELECT 1', (err: any) => {
        if (err) {
          console.error('Error creating connection:', err);
        } else {
          console.log('Connection created');
        }
        done(err, conn);
      });
    }
  },
});