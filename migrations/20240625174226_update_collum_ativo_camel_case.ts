import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('usuarios', (table) => {
        table.renameColumn('Ativo', 'ativo');
    });
}


export async function down(knex: Knex): Promise<void> {
}

