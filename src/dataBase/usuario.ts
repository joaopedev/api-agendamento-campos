import { Cras, TipoUsuario, UserModel } from './../models/model';
import { validate as isUUID } from 'uuid';
import DbInstance from '../connectionManager';
import { Scheduling } from './scheduling';

export class Usuario {
  public static async getUsers(): Promise<UserModel[]> {
    const knex = DbInstance.getInstance();

    let users = await knex('usuarios').select('*').orderBy('id');
    if (!users || users.length <= 0)
      throw new Error('Náo há nenhum usuário cadastrado!');

    return users;
  }

  public static async getFuncionariosByCras(
    cras: number
  ): Promise<UserModel[]> {
    const knex = DbInstance.getInstance();

    const funcionarios: UserModel[] = await knex('usuarios')
      .select('*')
      .where('cras', cras)
      .andWhereNot('tipo_usuario', TipoUsuario.comum)
      .orderBy('id');
      
    if (!funcionarios || funcionarios.length <= 0)
      throw new Error(
        `Náo há nenhum funcionário cadastrado no Cras ${Cras[cras]}!`
      );

    return funcionarios;
  }

  public static async getUserById(id: string): Promise<UserModel> {
    if (!isUUID(id)) throw new Error('ID de usuário inválido!');

    const knex = DbInstance.getInstance();

    const user: UserModel = await knex('usuarios')
      .select('*')
      .where('id', id)
      .first();
    if (!user) throw new Error('Náo há nenhum usuário com este Id!');

    return user;
  }

  public static async getUserByEmail(email: string): Promise<UserModel> {
    const knex = DbInstance.getInstance();

    const user = await knex('usuarios')
      .select('*')
      .where('email', email)
      .first();
    if (!user) throw new Error('Náo há nenhum usuário com este email!');

    return user;
  }

  public static async getUserByCpf(cpf: string): Promise<UserModel> {
    const knex = DbInstance.getInstance();

    const user = await knex('usuarios').select('*').where('cpf', cpf).first();
    if (!user) throw new Error('Náo há nenhum usuário com este CPF!');

    return user;
  }

  public static async createUser(usuario: UserModel): Promise<UserModel> {
    if (usuario.password.length < 8) {
      throw new Error('A senha deve ter pelo menos 8 caracteres');
    }

    const knex = DbInstance.getInstance();
    const trx = await knex.transaction();

    try {
      const existingUser = await trx('usuarios')
        .where({ cpf: usuario.cpf })
        .first();

      if (existingUser) {
        throw new Error('Este cpf já possui cadastro!');
      }

      await trx('usuarios').insert(usuario);
      await trx.commit();

      return usuario;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  public static async updateUser(usuario: UserModel): Promise<UserModel> {
    const idUsuario = usuario.id ?? '';
    let userBanco: UserModel = await this.getUserById(idUsuario);

    if (!userBanco) throw new Error('O usuário informado não existe!');

    const knex = DbInstance.getInstance();
    const trx = await knex.transaction();

    try {
      if (userBanco.ativo != usuario.ativo) {
        if (!usuario.ativo) {
          const usuarioId = usuario.id ?? '';
          Scheduling.cancelaUserSchedules(usuarioId);
        }
      }

      userBanco = { ...userBanco, ...usuario };

      await trx('usuarios').where('id', userBanco.id).first().update(userBanco);

      trx.commit();

      return userBanco;
    } catch (error) {
      trx.rollback();
      throw error;
    }
  }

  public static async deleteUser(id: string): Promise<boolean> {
    if (!isUUID(id)) throw new Error('ID de usuário inválido!');

    const userBanco: UserModel = await this.getUserById(id);

    if (!userBanco) return false;

    const knex = DbInstance.getInstance();
    const trx = await knex.transaction();

    try {
      const user = await trx('usuarios')
        .select('usuarios')
        .where('cpf', userBanco.cpf)
        .first()
        .delete();

      trx.commit();
      return !!user;
    } catch (error) {
      trx.rollback();
      throw error;
    }
  }
}
