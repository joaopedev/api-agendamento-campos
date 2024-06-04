import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    await knex.schema.table('usuarios', (table) => {
        table.boolean('Ativo').notNullable().defaultTo('1');
    })
}


export async function down(knex: Knex): Promise<void> {

    await knex.schema.table('usuarios', (table) => {
        table.dropColumn('Ativo');
    })
}

