import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    await knex.schema.table('scheduling', (table) => {
        table.integer('servico').notNullable();
        table.integer('cras').notNullable();
        table.integer('status').index().notNullable();
    });
}


export async function down(knex: Knex): Promise<void> {

    await knex.schema.table('scheduling', (table) => {
        table.dropColumn('servico');
        table.dropColumn('cras');
        table.dropColumn('status');
    });
}

