import { body, validationResult } from "express-validator";
import { HTTP_ERRORS, UserModel } from "../../models/model";
import createError from "http-errors";
import { UserLogin } from "../../dataBase/usuarioLogin";
import { Application, NextFunction, Request, Response } from "express";
import { tratarErro } from "../../utils/errors"
import { encodePassword } from "../../utils/bcrypFunctions";
import { Usuario } from "../../dataBase/usuario";

export = (app: Application) => {
  app.post(
    "/registerUsers",
    body("email").isEmail(),
    body("password")
      .exists()
      .isLength({ min: 8 })
      .withMessage("A senha deve conter pelo menos 8 caracteres"),
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return next(createError(HTTP_ERRORS.VALIDACAO_DE_DADOS,
                JSON.stringify(errors.array()))
            );
        }

        const { email, password, name, cpf }: UserModel = req.body;
        const usuario: UserModel = {
            email: email,
            name: name,
            cpf: cpf,
            password: password
        };

        if (!(email && password)) {
            return next(
                createError(HTTP_ERRORS.BAD_REQUEST, "Email ou senha inválidos")
            );
        }

        const hashPassword = encodePassword(password);
        usuario.password = hashPassword;

        await Usuario.createUser(usuario)
            .then(() => {
                res.json({ message: "Usuário cadastrado com sucesso" });
            })
            .catch((erro) => {
                console.error(erro);
                next(createError(HTTP_ERRORS.ERRO_INTERNO, tratarErro(erro)));
            }
        );        
    }
  );

  app.get(
    "/forgotPassword/:email",
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return next(
                createError(
                    HTTP_ERRORS.VALIDACAO_DE_DADOS,
                    JSON.stringify(errors.array())
                )
            );
        }

        const email: string = req.params.email;

        if (!email) {
            return next(createError(HTTP_ERRORS.BAD_REQUEST, "Email invalido!"));
        }

        await UserLogin.forgotPassword(email)
        .then(() => {
        res.json({
            message:
            "Foi enviado email de recuperação para o email cadastrado",
        });
        })
        .catch((erro) => {
            console.error(erro);
            next(createError(HTTP_ERRORS.BAD_REQUEST, tratarErro(erro)));
        });
        
    }
    
  );

  app.get(
    "/forgotWithToken/:token",
    async (req: Request, res: Response, next: NextFunction) => {
      const token = req.params.token;

      await UserLogin.updateForgotPassword(Number(token))
        .then((result) => {
          if (result) {
            res.json({ message: "Token valido" });
          } else {
            res.status(404).json({ message: "Token invalido" });
          }
        })
        .catch((erro) => {
          next(createError(HTTP_ERRORS.ERRO_INTERNO, erro));
        });
    }
  );

  app.put(
    "/resetPassword/:email",
    async (req: Request, res: Response, next: NextFunction) => {

      const usuario: UserModel | null = await Usuario.getUserByEmail(req.params.email);
      if(usuario === null) return next(createError("O email informado não esta cadastrado!"));

      const newPassword = req.body.newPassword;
      const hashPassword = encodePassword(newPassword);
      usuario.password = hashPassword;  
      
      await Usuario.updateUser(usuario)
        .then((result) => {
          if (result) {
            res.json({ message: "Senha atualizada com sucesso" });
          } else {
            res.status(404).json({ message: "Usuário não encontrado" });
          }
        })
        .catch((erro) => {
          next(createError(HTTP_ERRORS.ERRO_INTERNO, erro));
        });
    }
  );
};