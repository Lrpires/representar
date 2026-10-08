# Representantes: Fase 1 (núcleo e catálogo)

Next.js (App Router) + Supabase + Tailwind. Telas: login, criação do escritório,
representadas, clientes, produtos e tabelas de preço com lançamento de preços.

## Como rodar

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor, rode `supabase/migrations/001_nucleo_catalogo.sql`.
3. Em Authentication, defina a Site URL como `http://localhost:3000` e adicione
   `http://localhost:3000/auth/callback` nas Redirect URLs.
   Para testar sem e-mail de confirmação, desligue "Confirm email".
4. Copie `.env.example` para `.env.local` e preencha a URL e a chave pública
   (Project Settings > API).
5. Instale e rode:

```bash
npm install
npm run dev
```

Abra http://localhost:3000, crie uma conta e depois o escritório.

## Como funciona o acesso

- Quem cria o escritório vira dono.
- Dono e gerente cadastram representadas, produtos e tabelas de preço.
- Vendedor só lê o catálogo e vê apenas os próprios clientes.
- Tudo isso é garantido pelo banco (RLS), não só pelas telas.

## Checagem recomendada antes de seguir

Crie dois usuários em escritórios diferentes e confirme que um não vê nada do outro.

## Limitações conhecidas da Fase 1

- Sem convite de vendedores ainda (entra na Fase 5; por enquanto, só via SQL em `members`).
- Usa o primeiro escritório do usuário; a troca entre escritórios fica para depois.
- Sem edição nem exclusão nas telas, só cadastro e consulta.
- Sem importação de tabelas de preço por planilha.
- Para o app ser instalável (PWA), faltam ícones PNG 192 e 512 em `/public` e a entrada
  `icons` em `src/app/manifest.ts`. O modo offline entra na Fase 2.
