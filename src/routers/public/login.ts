import { HTTP_ERRORS } from "../../models/model";
import createError from "http-errors";
import { UserLogin } from "../../dataBase/usuarioLogin";
import { Application, NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { comparePasswords } from "../../utils/bcrypFunctions";

require("dotenv").config();

export = (app: Application) => {

    app.post(
    "/login",
    body("cpf").notEmpty().isString().trim().escape(),
    body("password").notEmpty().isString().trim().escape(),
    async (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            const message = errors.array().map( erro => erro.msg);
            next(createError(HTTP_ERRORS.BAD_REQUEST, message[0]));
        }

        const cpf: string = req.body.cpf;
        const password: string = req.body.password;

        if (!cpf) {
            return next(createError(HTTP_ERRORS.BAD_REQUEST, "cpf não pode ser vazio!"));
        }

        await UserLogin.loginUser(cpf, password)
            .then((usuario) => {
                if (!usuario) {
                    return res.status(401).json({ message: "Credenciais inválidas" });
                }
                if (!comparePasswords(password, usuario.password)) {
                    return res.status(401).json({ message: "Credenciais inválidas" });
                }
                
                const token = jwt.sign(
                    {
                        email: usuario.email,
                        id: usuario.id,
                        tipo_usuario: usuario.tipo_usuario,
                        cras: usuario.cras,
                        name: usuario.name,
                        cpf: usuario.cpf,
                        bairro: usuario.endereco.rua
                    },
                        `${process.env.JW_TOKEN}`,
                    {
                        expiresIn: "1h",
                    }
                );

                res.json({
                    message: "Usuário logado com sucesso",
                    token: token,
                });
                
            })
            .catch((erro) => {
                console.error(erro);
                next(createError(HTTP_ERRORS.ROTA_NAO_ENCONTRADA, erro));
            });
        }
    );
};