import { UserModel } from './../models/model';
import knex from "knex";

export class Usuario {

  public static async getUsers(): Promise<UserModel[]> {
    let users = knex("usuarios").select("*").orderBy("id");
    
    return users;
  }

  public static async getUserById(id: string): Promise<UserModel | null> {
    const user = await knex("usuarios").select("*").where("id", id).first();

    return user || null;
  }

  public static async createUser(usuario: UserModel): Promise<UserModel> {
    if (usuario.password.length < 8) {
      throw new Error("A senha deve ter pelo menos 8 caracteres");
    }

    try {
      const existingUser = await knex("usuarios")
        .where({ email: usuario.email })
        .first();

      if (existingUser) {
        throw new Error("Este email já está em uso");
      } else {
        await knex("usuarios").insert(usuario);
        return usuario;
      }
    } catch (error) {
      throw error;
    }
  }

  public static async updateUser(
    usuario: UserModel
  ): Promise<boolean> {
    const userBanco = this.getUserById(usuario.id);
    if(!userBanco) return false;

    const user = await knex("usuarios")
      .where("id", usuario.id)
      .update({ usuario });

    return user > 0;
  }

  public static async deleteUser(id_usuario: string): Promise<boolean> {
    const userBanco = this.getUserById(id_usuario);
    if(!userBanco) return false;

    const user = await knex("usuarios")
      .select("usuarios")
      .where("id", id_usuario)
      .delete();

    return user > 0;
  }

}