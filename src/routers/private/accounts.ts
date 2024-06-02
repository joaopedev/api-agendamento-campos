import { HTTP_ERRORS, TipoUsuario, UserModel } from "../../models/model";
import createError from "http-errors";
import { Usuario } from "../../dataBase/usuario";
import { Application, NextFunction, Request, Response } from "express";
import { encodePassword, comparePasswords } from "../../utils/bcrypFunctions";

export = (app: Application) => {
    app.get(
      "/private/account",
      async (req: Request, res: Response, next: NextFunction) => {
  
        await Usuario.getUsers()
          .then((contas) => {
            res.json({
              message: "Contas recuperadas com sucesso",
              contas: contas,
            });
          })
          .catch((erro) => {
            next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
          });
      }
    );
  
    app.get(
      "/private/accountById/:id",
      async (req: Request, res: Response, next: NextFunction) => {
        let id_usuario = req.params.id;
  
        await Usuario.getUserById(id_usuario)
          .then((conta) => {
            res.json({
              message: "Conta recuperada com sucesso",
              contas: conta,
            });
          })
          .catch((erro) => {
            next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS, erro));
          });
      }
    );

    app.put(
      "/private/updateAccount/:id",
      async (req: Request, res: Response, next: NextFunction) => {

        let usuario: UserModel | null = await Usuario.getUserById(req.params.id);
        
        if(!usuario) return next(createError(HTTP_ERRORS.BAD_REQUEST, "Id Invalido!"));
        
        const propsEnviadas: { [key: string]: any } = req.body;
       
        for (const prop in propsEnviadas) {
          if (Object.hasOwnProperty.call(propsEnviadas, prop)) {

            if(prop == "password") {
              if(!comparePasswords(req.body.password, usuario.password)) {
                const hashPassword = encodePassword(req.body.password);
                usuario.password = hashPassword;
              }
            }

            if (usuario.hasOwnProperty(prop) && prop != "password") {
              usuario[prop] = propsEnviadas[prop];
            }

          }
        }

        await Usuario.updateUser(usuario)
          .then((result) => {
            if (result) {
              res.json({ message: "Dados atualizados com sucesso" });
            } else {
              res.status(404).json({result});
            }
          })
          .catch((erro) => {
            next(createError(HTTP_ERRORS.ERRO_INTERNO, erro));
          });
      }
    );

    //A ROTA DE DELETE ESTÁ IMPLEMENTADA PORÉM, A EXCLUSÃO ATUAL É SOMENTE LÓGICA: TROCANDO O STATUS PARA 0 'CANCELADO'.
    app.delete(
      "/private/deleteAccount/:id",
      async (req: Request, res: Response, next: NextFunction) => {

        let usuarioDelete: UserModel| null = await Usuario.getUserById(req.params.id);
        let usuarioAdmin: UserModel | null= await Usuario.getUserById(req.params.adminId);
        
        if(!usuarioDelete) return next(createError(HTTP_ERRORS.BAD_REQUEST, "Id para exclusão Invalido!"));

        if(!usuarioAdmin || usuarioAdmin.tipoUsuario == TipoUsuario.comum) 
          return next(createError(HTTP_ERRORS.BAD_REQUEST, "Você não tem permissão para remover usuarios!"));

        await Usuario.deleteUser(usuarioDelete.cpf)
          .then((result) => {
            if (result) {
              res.json({ message: "Dados atualizados com sucesso" });
            } else {
              res.status(404).json(result);
            }
          })
          .catch((erro) => {
            next(createError(HTTP_ERRORS.ERRO_INTERNO, erro));
          });
      }
    );
}