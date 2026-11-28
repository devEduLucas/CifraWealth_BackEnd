# Importação de extratos bancários

## Fluxo atual

- Importação manual pelo seletor de arquivos do aplicativo.
- Formatos aceitos: OFX e CSV.
- O arquivo é enviado ao backend autenticado; limite de 2 MB e 5.000 lançamentos.
- Cada lançamento é salvo como **pendente**, na categoria "Importação bancária" (receita ou despesa).
- O aplicativo atualiza a lista de transações após a importação.
- Duplicatas são identificadas por usuário, data, valor com sinal e descrição normalizada.
- Não há conexão direta com bancos nem integração Open Finance. O usuário exporta o extrato no app/site do banco.
- Arquivos de cartão não são parte deste fluxo.

## CSV

O CSV precisa ter cabeçalhos identificáveis para data, descrição e valor. Também são aceitas colunas separadas de débito e crédito. Exemplos de cabeçalhos reconhecidos: `Data`, `Descrição`, `Valor`, `Débito`, `Crédito`, `Histórico`.

Valores brasileiros com vírgula decimal e delimitador ponto e vírgula são suportados, por exemplo `-125,90`.

## Teste local

1. Instale as dependências do backend e execute `npx prisma generate`.
2. Aplique a migration com `npx prisma migrate deploy` (ou use o fluxo de migration local do projeto).
3. Rode `npm test` no backend.
4. No mobile, execute `npx expo install expo-document-picker expo-file-system` para garantir versões compatíveis com o SDK instalado, depois inicie o app.
5. Abra **Transações**, toque no ícone de importar extrato e selecione um OFX/CSV de teste.

Recomenda-se usar primeiro um extrato fictício ou uma cópia sem dados sensíveis.
