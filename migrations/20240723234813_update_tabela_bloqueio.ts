import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.table('bloqueio_agendamento', (table) => {
        table.dropColumn('hora_inicio');
        table.dropColumn('hora_fim');
        table.timestamp('data').alter();
        table.enum('tipo_bloqueio', ['matutino', 'vespertino', 'diario']).notNullable();
        table.boolean('ativo').defaultTo(true);
      });
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.table('booking_restrictions', (table) => {
        // Reverter as alterações: 
        // Adicionar a coluna que foi removida
        table.time('hora_inicio');
        table.time('hora_fim');

        // Reverter a alteração da coluna de 'timestamp' para 'date'
        table.date('data').alter();

        // Remover a nova coluna booleana
        table.dropColumn('ativo');
        table.dropColumn('block_type');
    });
}

