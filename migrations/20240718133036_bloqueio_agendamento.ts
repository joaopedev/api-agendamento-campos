import { Knex } from 'knex';
import { onUpdateTrigger } from '../src/utils/onUpdateTrigger';

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('bloqueio_agendamento', table => {
        table.increments('id').primary();
        table.uuid("usuario_id").unsigned().notNullable(); 
        table.integer('cras').notNullable();
        table.date('data').notNullable();
        table.time('hora_inicio').nullable();
        table.time('hora_fim').nullable();
        table.string('motivo', 255).nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.foreign("usuario_id").references("id").inTable("usuarios");
    }).then(() => {
        knex.raw(onUpdateTrigger("bloqueio_agendamento"));
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('bloqueio_agendamento');
}
