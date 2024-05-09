import type { Knex } from "knex";
import { onUpdateTrigger } from "../src/utils/onUpdateTrigger";

export async function up(knex: Knex): Promise<void> {
    return knex.schema
      .createTable("scheduling_service", function (table) {
        table.increments("id").index().unique();
        table.string("name", 320).notNullable().index();
        table.string("description", 320).index();
        table.timestamp("data_hora").notNullable();
        table.timestamp("duracao_estimada");
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
      })
      .then(() => {
          knex.raw(onUpdateTrigger("scheduling_service"));
      });
  }
  
  export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("scheduling_service");
  }
  