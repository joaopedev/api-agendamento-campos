# API Agendamento CRAS

API Restful para manuseio e controle do backend da aplicação front-end.

## Dependencias de sistema

- Node.js
- Docker
- PostgreSQL

## Banco de Dados

Essa aplicacao vem com um arquivo `docker-compose.yml` utilizado para configurar um banco PostgreSQL no host.

Se tiver familiaridade com `docker-compose`, comandos do dia a dia irao funcionar normalmente.

## Migracoes e Seeding

Com o banco rodando, instale o CLI do `knex` para executar as migracoes.

```sh
knex migrate:latest
```

## Variaveis de Ambiente

```sh
cat > ./.env <<EOL

# porta do servidor
PORT=3000

# secret para autorizacao de rotas privadas
AUTHORIZATION=grandeSegredo

# host do banco de dados
HOST_BD=localhost

# nome do banco de dados
NOME_BD=postgres

# usuario do banco de dados
USER_BD=postgres

# senha do banco de dados
PASSWORD_BD=dbagendamentocampos
EOL
```

## Iniciar servidor de desenvolvimento

```sh
npm run dev
```

## Interagir com a API por Postman

Essa aplicacao vem com uma colecao de requests do Postman do root do projeto que irao te ajudar a navegar esse servico.

Use a funcao `Import` do Postman para importar a colecao.

**Atencao:** os dados no corpo requests podem precisar de mudancas para funcionar

## Construir imagem Docker

```sh
docker compose up
```

Para criação da imagem do container docker
