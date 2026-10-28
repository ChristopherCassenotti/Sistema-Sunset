# Sunset Importados — Etapa 1 (Hiper)

Projeto inicial Node.js 22 + TypeScript + Fastify. Ainda **não é** o catálogo completo.

## Objetivo

1. Obter Bearer Token a partir da chave de segurança do Hiper.
2. Listar a **primeira página** de produtos (somente leitura).
3. Exibir os campos básicos e identificar possíveis iPhones.
4. Testar o servidor local com `/health`.

A integração usa os endpoints da documentação técnica da API Personalizada do Hiper (arquivo fornecido pelo cliente).

## Antes de começar

- Node.js 22 ou 24 instalado (Node.js 22 recomendado para esta etapa).
- Integração personalizada ativada na conta Hiper.
- Chave de segurança acessível no Hiper Gestão: **Vendas → Loja virtual → Configurações padrões**.
- Produto(s) configurados com **Enviar para loja virtual**, marca, categoria e código de barras.

## Comandos no terminal do VS Code (PowerShell no Windows)

Abra **esta pasta**, que contém `package.json`, no VS Code.

```powershell
npm install
Copy-Item .env.example .env
```

Abra `.env` e substitua o marcador pelo valor real da chave de segurança. **Não envie esse arquivo a ninguém.**

```powershell
npm run hiper:test
```

Resultados esperados: mensagem de autenticação concluída, total de produtos na primeira página e até cinco exemplos de campos básicos. Os dados reais dependem do cadastro e das permissões da loja.

Para iniciar o servidor local:

```powershell
npm run dev
```

Em outra aba de terminal, execute:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Verificação de tipos e testes de unidade:

```powershell
npm run check
npm test
npm run build
```

## Segurança

- `.env` é ignorado pelo Git.
- **Nunca** coloque a chave Hiper em código, prints, logs, chat ou GitHub.
- O token Bearer não aparece no terminal.
- Não incluímos criação/cancelamento de pedidos nem alterações de estoque.
- O teste acessa apenas a primeira página de produtos.
- Erros são apresentados sem imprimir a URL de autenticação contendo a chave.

## O que ainda não foi implementado

- Paginação completa e sincronização incremental com `pontoDeSincronizacao`.
- Consulta específica e regra de estoque reservado.
- Webhooks do Hiper (precisamos de sua documentação específica).
- Banco MySQL da Hostinger.
- Tratamento de séries/grades de iPhone e campos de bateria/condição.
- Catálogo React, painel e integração com DKW.

## Infraestrutura futura

Hostinger Business: API Node.js gerenciada, MySQL e Cron Jobs. Ainda não precisa configurar a hospedagem para testar localmente.

## Diagnóstico

- **401/403:** conferir ativação da API, chave e permissões com Hiper.
- **Sem produtos:** conferir marca, categoria, código de barras, flag de envio à loja virtual e outras páginas.
- **Formato de resposta desconhecido:** o teste mostra apenas os nomes dos campos do primeiro nível para orientarmos o próximo mapeamento.
- **Falha de rede:** verificar conexão, firewall ou eventual indisponibilidade da API.
