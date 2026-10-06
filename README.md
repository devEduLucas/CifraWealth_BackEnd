# CifraWealth API

API Express 5, TypeScript, Prisma e MySQL. A estrutura separa rotas, controllers, validações, serviços e repositórios. Autenticação JWT protege transações, metas, categorias e relatórios.

## Executar

1. Configure um banco MySQL e copie .env.example para .env, preenchendo DATABASE_URL, JWT_SECRET, CORS_ORIGIN e GOOGLE_CLIENT_ID.
2. Execute npm install, npm run prisma:migrate e npm run dev.
3. O frontend usa http://localhost:3000/api por padrão. Em produção, npm run build e npm start.

Nunca publique o arquivo .env. O repositório inclui apenas valores de exemplo.

## Banco existente

Para um banco criado pelo SQL antigo que já contém usuarios, categorias, transacoes e metas_financeiras, confira a compatibilidade das tabelas e registre a base com npx prisma migrate resolve --applied 20260803104637_init antes de npm run prisma:migrate. Não use reset para atualizar um banco com dados.

O banco local deste projeto já foi verificado e atualizado. As migrations compatibilizam senha opcional/identificador Google e acrescentam id_usuario às categorias. Registros existentes são preservados: categorias antigas permanecem compartilhadas e somente leitura; categorias novas pertencem ao criador.

## Sprint 5

- POST /api/goals: cria meta, com objetivo positivo e até duas casas decimais.
- GET /api/goals e GET /api/goals/:id: metas somente do usuário autenticado.
- PUT /api/goals/:id: edita; descricao, data_inicio e data_fim aceitam null para remover valores opcionais. O status é recalculado ao alterar o objetivo.
- POST /api/goals/:id/contribute: recebe valor, soma à reserva e conclui a meta ao atingir o objetivo. Usa transação e bloqueio da linha no MySQL para preservar aportes simultâneos. Metas canceladas não aceitam aportes.
- DELETE /api/goals/:id: exclui somente a meta do usuário autenticado.
- GET /api/reports/detailed?data_inicio=2026-10-05&data_fim=2026-10-25: resumo, comparação anterior, meses, categorias, insights, transações e situação atual das metas. Datas inclusivas, intervalo de até cinco anos e somente transações confirmadas. Consulta sempre limitada ao usuário autenticado.
- GET /api/reports/monthly?ano=2026: compatibilidade com o dashboard, incluindo meses sem movimentos.
- GET /api/transactions?data_inicio=2026-10-05&data_fim=2026-10-25: filtro de transações por datas.

A reserva de uma meta é um registro manual do dinheiro já guardado. Não representa transferência bancária nem despesa. Valores monetários são persistidos como Decimal; relatórios somam centavos inteiros.

## Testes

- npm run typecheck e npm run build.
- npm test: cálculos, centavos, datas, períodos vazios e comparações. Não depende do frontend.
- npm run test:integration: API e MySQL local, com contas temporárias e limpeza restrita aos dados dos testes. Cobre autenticação, categorias por usuário, acesso cruzado, aportes simultâneos, conclusão/reabertura, datas, transações pendentes e relatórios.
- No frontend, npm run test:e2e executa os fluxos no Chrome em desktop e celular.
