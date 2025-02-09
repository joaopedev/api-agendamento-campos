import { Cras, TipoUsuario, UserModel } from './../models/model';
import { validate as isUUID } from 'uuid';
import DbInstance from '../connectionManager';
import { Scheduling } from './scheduling';
import { Knex } from 'knex';

export class Usuario {
  public static async getUsers(): Promise<UserModel[]> {
    const knex = DbInstance.getInstance();

    let users = await knex('usuarios').select('*').orderBy('id');
    if (!users || users.length <= 0)
      throw new Error('Náo há nenhum usuário cadastrado!');

    return users;
  }

  public static async getUsersFuncionarios(): Promise<UserModel[]> {
    const knex = DbInstance.getInstance();

    let users = await knex('usuarios')
      .select('*')
      .where('tipo_usuario', TipoUsuario.admin);
    if (!users || users.length <= 0)
      throw new Error('Náo há nenhum usuário cadastrado!');

    return users;
  }

  public static async getFuncionariosByCras(
    cras: number,
    trx?: Knex.Transaction
  ): Promise<UserModel[]> {
    const query = trx ? trx('usuarios') : DbInstance.getInstance()('usuarios');

    const funcionarios: UserModel[] = await query
      .select('*')
      .where('cras', cras)
      .andWhere('tipo_usuario', TipoUsuario.admin)
      .orderBy('id');

    if (!funcionarios || funcionarios.length <= 0)
      throw new Error(
        `Náo há nenhum funcionário cadastrado no Cras ${Cras[cras]}!`
      );

    return funcionarios;
  }

  public static async getUserById(
    id: string,
    trx?: Knex.Transaction
  ): Promise<UserModel> {
    if (!isUUID(id)) throw new Error('ID de usuário inválido!');

    const query = trx ? trx('usuarios') : DbInstance.getInstance()('usuarios');

    const user: UserModel = await query.select('*').where('id', id).first();
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

  public static async getUserByCpf(
    cpf: string,
    trx?: Knex.Transaction
  ): Promise<UserModel> {
    const query = trx ? trx('usuarios') : DbInstance.getInstance()('usuarios');

    const user = await query.select('*').where('cpf', cpf).first();

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

    const knex = DbInstance.getInstance();
    const trx = await knex.transaction();

    let userBanco: UserModel = await this.getUserById(idUsuario, trx);

    if (!userBanco) throw new Error('O usuário informado não existe!');

    let existeCpf: UserModel;
    if (usuario.cpf) {
      existeCpf = await this.getUserByCpf(usuario.cpf, trx);
      if (existeCpf && existeCpf.cpf != userBanco.cpf)
        throw new Error('CPF ja existente no sistema!');
    }

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
