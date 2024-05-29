import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    await knex.schema.alterTable('usuarios', (table) => {
        table.string('email').nullable().alter();
    });

    await knex.schema.table('usuarios', (table) => {
        table.integer('tipoUsuario').notNullable().defaultTo('1');
        table.integer('cras').notNullable().defaultTo('0');
        table.string('telefone').notNullable().defaultTo('0');
        table.string('dataNascimento').notNullable().defaultTo('0');
        table.json('endereco').notNullable().defaultTo('{}');
    });
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.table('usuarios', (table) => {
        table.dropColumn('tipoUsuario');
        table.dropColumn('cras');
        table.dropColumn('telefone');
        table.dropColumn('dataNascimento');
        table.dropColumn('endereco');
    });
}

