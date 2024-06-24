import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.table('scheduling', (table) => {
        table.dropColumn('duracao_estimada');
        table.integer('duracao_atendimento');
      });
}


export async function down(knex: Knex): Promise<void> {
}

