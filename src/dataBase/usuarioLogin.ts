import DbInstance from "../connectionManager";
import { Cras, UserModel } from "../models/model";
import { comparePasswords, generateToken } from "../utils/bcrypFunctions"
import * as nodemailer from 'nodemailer';

require("dotenv").config();

export class UserLogin{

  public static async loginUser(cpf: string, senha: string): Promise<UserModel> {
    return new Promise((resolve, reject) => {

      const knex = DbInstance.getInstance();

      knex("usuarios")
        .select("*")
        .where("cpf", cpf)
        .first()
        .then((usuarioBanco: UserModel | any) => {
          
          if (!usuarioBanco) return reject(new Error("Nenhum usuário encontrado com este cpf!"));

          const user: UserModel = usuarioBanco;

          if(!user.ativo) return reject(new Error(`Este usuário está inativo, entre em contato com o suporte no CRAS de ${Cras[user.cras].replace("_", " ")}!`));

          if (!comparePasswords(senha, user.password)) return reject(new Error("Senha incorreta!"));
            
          return resolve(user);

        })
        .catch((erro: any) => {
          reject(erro);
        });
    });
  }

  public static async forgotPassword(email: string): Promise<boolean> {
    try {
      const knex = DbInstance.getInstance();

      const user: UserModel | undefined = await knex("usuarios")
        .where("email", email)
        .first();

      if (!user) throw new Error("Usuário não encontrado");

      const resetToken: string = generateToken();
      const now: Date = new Date();
      now.setHours(now.getHours() + 1);

      await knex("usuarios").where("id", user.id).update({
        passwordResetToken: resetToken,
        passwordResetExpires: now,
      });

      setTimeout(async () => {
        await knex("usuarios").where("id", user.id).update({
          passwordResetToken: null,
          passwordResetExpires: null,
        });
      }, 3600000);

      const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        auth: {
          user: process.env.USER_GMAIL,
          pass: process.env.USER_GMAIL_PASSWORD,
        },
      });

      const mailOptions = {
        from: "contaparaoaplicativo46@gmail.com",
        to: `${user.email}`,
        subject: "Recuperação de Senha",
        html: `<p>Olá ${user.email},</p>
          <p>Você solicitou a redefinição da sua senha. Utilize este token para recuperar a senha:</p>
          <p>${resetToken}</p>
          <p>Se você não solicitou a redefinição de senha, ignore este e-mail.</p>`,
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      throw new Error("Erro ao enviar o e-mail de recuperação de senha");
    }
  }

  public static async updateForgotPassword(
    token: number
  ): Promise<UserModel | null> {
    const knex = DbInstance.getInstance();
    const user: UserModel = await knex("usuarios")
      .select("*")
      .where("passwordResetToken", token)
      .first();

    return user || null;
  }

}