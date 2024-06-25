import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('usuarios', (table) => {
        table.renameColumn('passwordResetToken', 'password_reset_token');
        table.renameColumn('passwordResetExpires', 'password_reset_expires');
        table.renameColumn('tipoUsuario', 'tipo_usuario');
        table.renameColumn('dataNascimento', 'data_nascimento');
    });
}


export async function down(knex: Knex): Promise<void> {
}

