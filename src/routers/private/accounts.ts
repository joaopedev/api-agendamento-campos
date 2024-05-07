import { HTTP_ERRORS } from "../../models/model";
import createError from "http-errors";
import { Usuario } from "../../dataBase/usuario";
import { Application, NextFunction, Request, Response } from "express";
import { encodePassword } from "../../utils/bcrypFunctions";

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
}