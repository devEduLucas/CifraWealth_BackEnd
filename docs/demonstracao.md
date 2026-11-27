# Conta com histórico para apresentação

O site da Vercel lê os dados da API configurada em `VITE_API_URL`. O MySQL do computador é outro ambiente: preparar uma conta local não preenche automaticamente a mesma conta no servidor publicado.

Para apresentar os fluxos reais, mantenha `VITE_DEMO_MODE=false` e use uma conta exclusiva no backend público. Não é necessário copiar o banco inteiro, publicar `.env` ou alterar as contas dos colegas.

## Preparar a conta publicada

1. Crie a conta pela página pública de cadastro e confirme o e-mail recebido. Se ela já existir, teste o login. O importador não redefine senhas nem contorna a confirmação.
2. No terminal deste repositório, visualize o plano sem autenticar ou gravar dados:

   ```powershell
   npm run demo:seed -- --api https://cifrawealth-backend.onrender.com/api
   ```

3. Para aplicar os dados à conta que autenticar:

   ```powershell
   npm run demo:seed -- --api https://cifrawealth-backend.onrender.com/api --email conta.demonstracao@exemplo.com --apply
   ```

   Substitua o e-mail pelo da conta autorizada. A senha será solicitada de forma oculta no terminal. Não use `--password`, não salve a senha no código nem em variáveis públicas `VITE_`.

4. Entre nessa conta pelo site da Vercel e selecione **Últimos 6 meses** nos relatórios. Para reproduzir exatamente o histórico, use **01/06/2026 a 25/11/2026**.

O script usa exclusivamente a API e a sessão da própria conta. Não precisa de `DATABASE_URL`, chave Brevo ou credencial administrativa. Para dados locais, aponte `--api` para `http://localhost:3000/api`.

## Conteúdo e preservação dos dados

- 95 transações fictícias com prefixo `[QA5M]`: salários, receitas extras e despesas de diferentes categorias, de junho a novembro de 2026.
- Meses positivos e negativos, centavos, uma pendência antiga, uma atual e registros futuros para distinguir realizado e previsto.
- Quatro metas: duas ativas, uma concluída e uma cancelada.
- Categorias necessárias criadas apenas quando ainda não existem na conta.

O script preserva os dados existentes e reconhece os mesmos lançamentos em uma nova execução, sem duplicá-los. Se um lançamento fictício reconhecível tiver sido editado, para antes de inserir, em vez de sobrescrever a edição. Uma interrupção pode ser retomada executando novamente; metas existentes com saldo diferente são preservadas e informadas como aviso. Se descrições ou datas dos dados fictícios forem alteradas manualmente, revise a conta antes de importar novamente.

Não execute na conta financeira pessoal: esses registros passam a compor seus totais. Não há exclusão global automática. As metas representam o saldo atual; o modelo não guarda um extrato histórico de aportes.

## Publicar as correções

As correções precisam ser publicadas nos respectivos serviços. Alterar os arquivos no computador não atualiza a Vercel ou o Render. Publique o backend e depois o frontend para apresentar a regra corrigida de realizados até hoje.

Confira as variáveis **Production** na Vercel:

```dotenv
VITE_API_URL=https://cifrawealth-backend.onrender.com/api
VITE_DEMO_MODE=false
```

Depois de alterar variáveis, faça um novo deployment: elas não modificam um build já publicado. Veja [variáveis de ambiente na Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables). No backend, `FRONTEND_URL` deve apontar para o site público e o CORS deve permitir sua origem.

`TRUST_PROXY` deve refletir a topologia real da hospedagem. O padrão é `false`; quem administra o serviço deve verificar o número de proxies confiáveis ou suas redes. Não use confiança irrestrita para eliminar um aviso. Consulte o README.

Antes da apresentação, entre pelo domínio que será utilizado e confira dashboard, filtros, mês negativo, meta individual e download de PDF/CSV. Faça uma pequena alteração na conta demonstrativa e recarregue para verificar a persistência. Separe uma cópia do PDF como apoio.

O sucesso de `/api/health` só indica que o servidor respondeu. A validação final deve incluir login e leitura de dados dessa conta.
