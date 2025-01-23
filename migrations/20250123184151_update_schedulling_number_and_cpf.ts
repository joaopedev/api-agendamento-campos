import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('scheduling', (table) => {
        table.string('cpf', 11);
        table.string('telefone', 11);
        table.string('criador_id', 36);    
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('scheduling', (table) => {
        table.dropColumn('cpf');
        table.dropColumn('telefone');
        table.dropColumn('criador_id');
    });
}

