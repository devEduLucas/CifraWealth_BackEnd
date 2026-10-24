# CifraWealth API

API Express 5, TypeScript, Prisma e MySQL. A estrutura separa rotas, controllers, validações, serviços e repositórios. Autenticação JWT protege transações, metas, categorias e relatórios.

## Executar

1. Configure um banco MySQL e copie .env.example para .env, preenchendo DATABASE_URL e um JWT_SECRET aleatório. GOOGLE_CLIENT_ID é opcional e habilita o login com Google.
2. Execute npm install, npm run prisma:migrate e npm run dev.
3. A API local usa http://localhost:3000/api; o frontend usa http://localhost:5173. CORS_ORIGIN e FRONTEND_URL devem apontar para a URL do frontend. Em produção, npm run build e npm start.

Nunca publique o arquivo .env. O repositório inclui apenas valores de exemplo.

O cliente em src/generated/prisma é gerado no postinstall. Ele ainda é versionado e pode apresentar diferenças de caminhos locais após npm install; revise o diff antes de commitar. Se o Windows impedir a substituição da DLL durante prisma generate, pare a instância local da API que está usando o Prisma e execute npm run prisma:generate novamente.

## Cadastro e confirmação de e-mail

- O envio usa a API HTTPS da Brevo. Preencha BREVO_API_KEY com a chave de API e BREVO_SENDER_EMAIL com um remetente validado na sua conta Brevo; BREVO_SENDER_NAME define o nome exibido. A configuração de SMTP/Gmail da versão anterior não é usada.
- Configure FRONTEND_URL e EMAIL_VERIFICATION_SECRET com um segredo aleatório de pelo menos 32 caracteres, diferente de JWT_SECRET. Para gerar cada segredo, execute `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` e guarde o resultado somente no .env.
- Sem configuração completa de envio, cadastro, reenvio e recuperação de senha retornam 503, inclusive no desenvolvimento. Links e tokens não são exibidos nos logs. A simulação existe somente nos testes locais; login por senha de contas já confirmadas e login Google não dependem de envio de e-mails.
- BREVO_TIMEOUT_MS limita a espera pelo provedor (padrão 10000 ms, entre 100 e 30000). Falhas e timeout retornam 502. BREVO_API_URL usa o endpoint oficial por padrão e permite apontar os testes para um mock HTTP local.
- POST /api/users/register recebe fullName, email e password, cria uma conta pendente e retorna email/message. O link recebido abre /verify-email; para ativar, informe a mesma senha daquela tentativa.
- POST /api/users/verify-email exige token e password. O token dura 24 horas, é vinculado às credenciais e não serve para acessar a API. Links de versões anteriores devem ser reenviados após esta atualização.
- Repetir um cadastro pendente após um minuto atualiza suas credenciais e invalida o link anterior. Durante esse minuto, o servidor retorna 429 sem alterar a senha. Confirmar exige tanto o link quanto a senha correspondente.
- POST /api/users/resend-verification recebe email e respeita o intervalo de um minuto. A resposta é genérica; contas confirmadas não recebem novo link.
- Falha no envio remove somente a tentativa ainda pendente e correspondente àquela senha, preservando contas ativadas ou atualizadas durante o envio. Tokens e links completos não são escritos nos logs.

## Recuperação de senha e sessões

- POST /api/auth/forgot-password recebe email. Para contas ausentes ou exclusivas do Google, a resposta é genérica. Contas com senha recebem um link de recuperação com validade de uma hora quando o provedor está configurado.
- POST /api/auth/reset-password recebe token e password. A atualização condicional permite usar o link uma única vez, inclusive em requisições simultâneas. A senha segue os limites de 8 caracteres e 72 bytes.
- Recuperação limita solicitações a 10 por hora por IP; redefinição permite até 30 tentativas por 15 minutos por IP.
- Sessões são vinculadas por HMAC às credenciais atuais. Trocar a senha invalida os tokens anteriores imediatamente, sem alteração de schema. Ao atualizar uma instalação anterior a essa proteção, os usuários precisam entrar novamente uma vez.

Reinicie o backend após alterar o .env. Em produção, use as URLs HTTPS do ambiente em CORS_ORIGIN/FRONTEND_URL e configure o frontend com a URL pública desta API.

## Banco existente

Para um banco criado pelo SQL antigo que já contém usuarios, categorias, transacoes e metas_financeiras, confira a compatibilidade das tabelas e registre a base com npx prisma migrate resolve --applied 20260803104637_init antes de npm run prisma:migrate. Não use reset para atualizar um banco com dados.

As migrations compatibilizam senha opcional/identificador Google e tornam as categorias próprias de cada usuário. A migration 20261008120000_categorias_por_usuario copia categorias iniciais, recategoriza transações e remove os registros compartilhados. Cada nova conta recebe suas categorias iniciais, editáveis e removíveis quando não possuem transações.

A migration 20261012150000_email_verification_backfill mantém o acesso das contas anteriores à ativação da verificação. Aplique migrations antes de iniciar a nova versão; contas criadas depois precisam confirmar o e-mail. Confira cada ambiente com `npx prisma migrate status`, em vez de assumir que seu banco já está atualizado.

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

## Correções da avaliação de usabilidade

- O dashboard considera somente transações confirmadas até a data atual em `America/Sao_Paulo`. Um `data_fim` futuro não antecipa o saldo realizado. O saldo não representa consulta bancária, saldo inicial ou reservas das metas.
- Criação de transação sem `status`: datas futuras começam como `pendente`; demais datas começam como `confirmada`. A interface oferece edição e confirmação de pendências. Lançamentos futuros são identificados como previstos.
- `GET /api/reports/monthly?ano=2026&data_fim=2026-10-18` aceita um corte opcional por data, usado no dashboard. Relatórios personalizados mantêm seu período explícito e consideram somente registros confirmados.
- `POST /api/goals/:id/withdraw` recebe `{ "valor": 100 }`, valida saldo suficiente e registra a retirada com o mesmo bloqueio de linha usado nos aportes. O progresso e a situação são recalculados. `PUT /api/goals/:id` com `valor_atual` corrige o total, incluindo zero; aceita até duas casas decimais. Essas operações não criam despesas ou transferências.
- A migração `20261018230000_unique_user_categories` adiciona unicidade por usuário, nome e tipo. Não exclui, renomeia nem consolida categorias. Se um ambiente já tiver duplicatas, elas precisam ser avaliadas antes da aplicação; o índice falha preservando esses registros.
- Os `overrides` fixam versões corrigidas de `body-parser`, `proxy-addr`, `qs`, `deepmerge-ts` e `uuid`, preservando Prisma 6 e a interface atual de autenticação. `body-parser` 2.4.0 corrige o encerramento do processo por corpos comprimidos malformados descrito em [GHSA-27r3-jxmh-p828](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828). Ao removê-los no futuro, confira as versões transitivas e rode os testes e o audit novamente.

Depois de instalar as dependências, aplique `npm run prisma:migrate` antes de iniciar o backend. Para executar `npm run prisma:generate` no Windows, pare o backend primeiro: o processo em execução pode manter a DLL do Prisma bloqueada. Não use `migrate reset` nem restaure arquivos gerados para tentar corrigir esse bloqueio.

## Testes

- npm run typecheck, npm run typecheck:tests e npm run build. A verificação dos testes inclui os arquivos fora de src para detectar referências removidas.
- npm test: cálculos, centavos, datas, períodos vazios, comparações, finalidade dos tokens e invalidação de sessões. Não depende do frontend.
- npm run test:integration: API e MySQL local, com contas temporárias e limpeza restrita aos dados dos testes. Cobre categorias por usuário, acesso cruzado, aportes simultâneos, conclusão/reabertura, datas, transações pendentes e relatórios. Também verifica cadastro, confirmação, recuperação, concorrência na redefinição, sessões antigas, limites de requisições e falha/timeout de envio com mock HTTP local da Brevo, sem mensagens para destinatários externos.
- No frontend, npm run test:e2e executa os fluxos no Chrome em desktop e celular.
