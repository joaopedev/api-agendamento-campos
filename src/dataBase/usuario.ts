import { Cras, TipoUsuario, UserModel } from './../models/model';
import { knex } from "../connectDB";

export class Usuario {

  public static async getUsers(): Promise<UserModel[]> {

    let users = await knex("usuarios").select("*").orderBy("id");
    if(!users || users.length <= 0) throw new Error("Náo há nenhum usuário cadastrado!");
    
    return users;
  }

  public static async getFuncionariosByCras(cras: number): Promise<UserModel[]> {

    const funcionarios: UserModel[]  = await knex("usuarios").select("*").where("cras", cras).andWhere("tipoUsuario", TipoUsuario.admin).orderBy("id");
    if(!funcionarios || funcionarios.length <= 0) throw new Error(`Náo há nenhum funcionário cadastrado no Cras ${Cras[cras]}!`);
    
    return funcionarios;
  }

  public static async getUserById(id: string): Promise<UserModel> {

    const user:UserModel  = await knex("usuarios").select("*").where("id", id).first();  
    if(!user) throw new Error("Náo há nenhum usuário com este Id!");

    return user;
  }

  public static async getUserByEmail(email: string): Promise<UserModel> {

    const user = await knex("usuarios").select("*").where("email", email).first();
    if(!user) throw new Error("Náo há nenhum usuário com este email!");

    return user;
  }

  public static async getUserByCpf(cpf: string): Promise<UserModel> {

    const user = await knex("usuarios").select("*").where("cpf", cpf).first();
    if(!user) throw new Error("Náo há nenhum usuário com este CPF!");

    return user;
  }

  public static async createUser(usuario: UserModel): Promise<UserModel> {
    if (usuario.password.length < 8) {
      throw new Error("A senha deve ter pelo menos 8 caracteres");
    }

    try {

      const existingUser = await knex("usuarios")
        .where({ cpf: usuario.cpf })
        .first();

      if (existingUser) {
        throw new Error("Este cpf já possui cadastro!");
      }

      await knex("usuarios").insert(usuario);
      return usuario;
      
    } catch (error) {
      throw error;
    }
  }

  public static async updateUser(
    usuario: UserModel
  ): Promise<UserModel> {

    const idUsuario = usuario.id ?? "";
    let userBanco: UserModel = await this.getUserById(idUsuario);

    if(!userBanco) throw new Error("O usuário informado não existe!");;

    userBanco = { ...userBanco, ...usuario };

    try {
      
      await knex("usuarios")
        .where("id", userBanco.id)
        .first()
        .update(userBanco);
     
      return userBanco;

    } catch (error) {
      throw error
    }
  }

  public static async deleteUser(cpf: string): Promise<boolean> {
    const userBanco: UserModel = await this.getUserByCpf(cpf);

    if(!userBanco) return false;

    try {
      
      const user = await knex("usuarios")
        .select("usuarios")
        .where("cpf", userBanco.cpf)
        .first()
        .delete();
  
      return !!user;

    } catch (error) {
      throw error;
    }
  }

}