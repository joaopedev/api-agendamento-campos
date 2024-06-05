import { HTTP_ERRORS, TipoUsuario, UserModel } from "../../models/model";
import createError from "http-errors";
import { Usuario } from "../../dataBase/usuario";
import { Application, NextFunction, Request, Response } from "express";
import { encodePassword, comparePasswords } from "../../utils/bcrypFunctions";
import { Scheduling } from "../../dataBase/scheduling";

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

        let usuario: UserModel = await Usuario.getUserById(req.params.id);
        
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

    app.delete(
      "/private/deleteAccount/",
      async (req: Request, res: Response, next: NextFunction) => {
        
        let usuarioId = req.query.id?.toString() ?? "";
        let adminId = req.query.funcionarioId?.toString() ?? "";

        let usuarioDelete: UserModel = await Usuario.getUserById(usuarioId);
        let usuarioAdmin: UserModel = await Usuario.getUserById(adminId);
        
        if(!usuarioDelete.id || !usuarioAdmin) return next(createError(HTTP_ERRORS.BAD_REQUEST, "Id para exclusão Invalido!"));

        if(usuarioAdmin.tipoUsuario != TipoUsuario.superAmin) 
          return next(createError(HTTP_ERRORS.BAD_REQUEST, "Você não tem permissão para excluir usuarios!"));

        const agendamentosDoUsuario = await Scheduling.getScheduleByUserId(usuarioDelete.id);

        if(agendamentosDoUsuario.length > 0) {
          const deletou = await Scheduling.deleteUserSchedules(agendamentosDoUsuario);
          if(!deletou) return next(createError(HTTP_ERRORS.ERRO_INTERNO, "Ocorreu um erro ao tentar excluir os agendamentos deste usuário!"));
        }

        await Usuario.deleteUser(usuarioDelete.id)
          .then((result) => {
            if (result) {
              res.json({ message: "Usuário e agendamentos deletados com sucesso" });
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