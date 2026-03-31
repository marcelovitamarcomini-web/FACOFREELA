# Deploy na HostGator

## Front-end React + Vite

1. Gere o pacote pronto para upload:

```bash
npm run build:hostgator
```

Esse comando faz duas coisas:

- gera o build do front em `dist/`
- monta uma copia limpa para hospedagem em `deploy/hostgator-root/`
- cria o arquivo `deploy/beta.facofreela.com.br.zip`

2. Envie para a raiz do subdominio o ZIP `deploy/beta.facofreela.com.br.zip` ou o conteudo de `deploy/hostgator-root/`.

Nao envie a raiz do projeto. O arquivo correto para producao e o `dist/index.html`, nao o `index.html` da raiz.

3. Extraia o ZIP diretamente dentro da pasta raiz do subdominio.

Para o seu caso, a estrutura final dentro de `/home1/marc7206/beta.facofreela.com.br/` precisa ficar assim:

- `index.html`
- `.htaccess`
- `assets/`
- `favicon.ico`
- `logo.png`

4. Mantenha o arquivo `.htaccess` no servidor.

Ele faz o rewrite das rotas do React Router para `index.html`.

## Setup do Supabase

Antes do primeiro deploy estatico, execute no SQL Editor do Supabase:

`supabase/hostgator_static_setup.sql`

Esse arquivo agora tambem faz o bootstrap das tabelas-base esperadas pelo app (`profiles`, `client_profiles` e `freelancer_profiles`), alem de criar a estrutura do chat, liberar as policies necessarias para o front acessar perfis e sessao direto no navegador, e preparar upload de avatar e banner sem depender do servidor Node.

Ele e idempotente: pode ser executado em projeto novo ou em uma base que ja tenha parte da estrutura criada.

## Publicacao em subpasta

Se o site nao ficar na raiz do dominio e sim em algo como `/facofreela/`, configure antes do build:

```env
VITE_APP_BASE_PATH=/facofreela/
```

Depois gere o build novamente e publique o novo `dist/`.

## Observacao

Depois dessa migracao, o front passa a falar direto com o Supabase. A hospedagem fica responsavel apenas pelos arquivos estaticos em `dist/`.
