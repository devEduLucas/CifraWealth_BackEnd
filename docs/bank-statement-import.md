# Importação de extratos bancários

## Fluxo

- Importação manual pelo seletor de arquivos do aplicativo.
- Formatos aceitos: OFX, CSV e PDF com camada de texto selecionável.
- Arquivos enviados ao backend autenticado; limite de 2 MB e 5.000 movimentações.
- PDFs limitados a 100 páginas por importação.
- Cada lançamento é salvo como **pendente**, na categoria "Importação bancária" (receita ou despesa).
- O aplicativo atualiza a lista de transações após a importação.
- Duplicatas são identificadas por usuário, data, valor com sinal e descrição normalizada.
- Não há conexão direta com bancos nem integração Open Finance. O usuário exporta o extrato no app/site do banco.
- Arquivos de cartão não fazem parte deste fluxo.

## PDF

O backend usa PDF.js para extrair o texto diretamente do documento. O conteúdo do extrato é processado no próprio backend, sem envio a serviços externos de OCR.

O parser reconhece datas no formato `DD/MM/AAAA`, valores brasileiros com vírgula decimal e marcadores de débito/crédito (`D`/`C`) ou sinais positivo/negativo. Também usa palavras presentes na descrição para sugerir a direção da movimentação. Linhas ambíguas, sem sinal ou indicação clara de crédito/débito, não são importadas.

PDFs escaneados como imagem, protegidos por senha ou sem texto selecionável ainda não são suportados. Nesses casos, o aplicativo apresenta uma mensagem para o usuário em vez de criar lançamentos estimados. OCR poderá ser adicionado futuramente.

O layout do extrato Itaú PF ainda precisa ser validado com um arquivo real sem dados pessoais. A estrutura de PDF varia entre bancos e versões do documento; não se deve considerar o parser homologado para o Itaú antes desse teste.

## OFX

Arquivos OFX são lidos pelos campos de data, valor e descrição da transação. Valores negativos são despesas e positivos são receitas.

## CSV

O CSV precisa ter cabeçalhos identificáveis para data, descrição e valor. Também são aceitas colunas separadas de débito e crédito. Exemplos de cabeçalhos reconhecidos: `Data`, `Descrição`, `Valor`, `Débito`, `Crédito`, `Histórico`.

Valores brasileiros com vírgula decimal e delimitador ponto e vírgula são suportados, por exemplo `-125,90`.

## Teste local

1. Instale as dependências do backend e execute `npx prisma generate`.
2. Aplique a migration com `npx prisma migrate deploy` (ou use o fluxo de migration local do projeto).
3. Rode `npm test` e `npm run build` no backend.
4. No mobile, execute `npx expo install expo-document-picker expo-file-system` para garantir versões compatíveis com o SDK instalado e depois inicie o app.
5. Abra **Transações**, toque no ícone de importar extrato e selecione um OFX, CSV ou PDF de teste.

Recomenda-se testar primeiro com um extrato fictício. Antes de usar um extrato real, oculte CPF, nome, agência, conta, saldo e outros dados pessoais caso compartilhe o arquivo para ajustar o parser.
