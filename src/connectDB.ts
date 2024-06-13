import Knex from "knex";
require("dotenv").config();

export const knex = Knex({
  client: "pg",
  connection: {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE
  }
});