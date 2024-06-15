import express, { json, Response, NextFunction, Request } from "express";
import createError from "http-errors";
import helmet from "helmet";
import cors from "cors";
import { HTTP_ERRORS } from "./models/model";
import DbInstance from "./connectionManager";
import  rateLimit  from "express-rate-limit"

const consign = require("consign");
require("dotenv").config();

const AUTHORIZATION = process.env.AUTHORIZATION;

const app = express();

app.use(helmet());
app.use(cors());
app.use(json());


// Limite de taxa para prevenir ataques DDOS
// const limiter = rateLimit({
//   windowMs: 5 * 60 * 1000, // 5 minutos
//   max: 5, // Limita cada IP a 30 requisições por janela
//   message: 'Muitas requisições vindas deste IP, por favor, tente novamente mais tarde.',
//   standardHeaders: true, // Retorna informações de limite nos headers `RateLimit-*`
//   legacyHeaders: false, // Desabilita os headers `X-RateLimit-*`
// });

// app.use(limiter);

app.use("/private/*", (req: Request, res: Response, next: NextFunction) => {
  let authorization = req.header("authorization");
  if (authorization == AUTHORIZATION) {
    next();
  } else {
    next(
      createError(
        HTTP_ERRORS.ACESSO_NAO_AUTORIZADO,
        "login incorreto ao acessar rota privada"
      )
    );
  }
});

consign({ cwd: __dirname }).include("routers").into(app);

app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  // Set HTTP Status Code
  res.status(error.status);
  // Send response
  res.json({ message: error.message });
});

const server = app.listen(Number(process.env.PORT), () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`);
});

const shutdown = async () => {
  try {
    // Fechando a conexão com o banco
    await DbInstance.destroyInstance();
    
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Configurar handlers para sinais de encerramento do processo
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
