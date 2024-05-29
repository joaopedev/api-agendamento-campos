import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    await knex.schema.table('scheduling', (table) => {
        table.dropForeign(['servico_id']);
        table.dropColumn('servico_id');
      });
    
    await knex.schema.dropTableIfExists('scheduling_service');
}


export async function down(knex: Knex): Promise<void> {
}

