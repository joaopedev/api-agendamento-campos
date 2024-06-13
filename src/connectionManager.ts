import { Knex, knex } from 'knex';
const knexConfig = require('./../knexfile');
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

class DbInstance {
  private static instance: Knex | null = null;;

  static getInstance(): Knex {
    if (!DbInstance.instance) {
      DbInstance.instance = knex(config);
    }
    return DbInstance.instance;
  }

  static async destroyInstance(): Promise<void> {
    if (DbInstance.instance) {
      await DbInstance.instance.destroy();
      DbInstance.instance = null;
    }
  }
}

export default DbInstance;