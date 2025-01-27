import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('scheduling', table => {
    table.string('telefone', 15).alter();
    // Adicione outras alterações se precisar
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('scheduling', table => {
    table.string('telefone', 11).alter(); // ou o tamanho anterior
  });
}
