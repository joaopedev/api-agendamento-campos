import { Knex } from "knex";
import { onUpdateTrigger } from "../src/utils/onUpdateTrigger";

export async function up(knex: Knex): Promise<void> {
    return knex.schema
      .createTable("scheduling", function (table) {
        table.increments("id").primary().index().unique();
        table.uuid("usuario_id").unsigned().notNullable(); // Alteração: Removendo o increments e definindo como integer
        table.integer("servico_id").unsigned().notNullable(); // Alteração: Removendo o increments e definindo como integer
        table.string("name", 320).notNullable().index();
        table.string("description", 320).index();
        table.timestamp("data_hora").notNullable();
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
        table.timestamp("duracao_estimada");
        table.foreign("usuario_id").references("id").inTable("usuarios");
        table.foreign("servico_id").references("id").inTable("scheduling_service");
      })
      .then(() => {
          knex.raw(onUpdateTrigger("scheduling"));
      });
  }
  
  export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("scheduling");
  }